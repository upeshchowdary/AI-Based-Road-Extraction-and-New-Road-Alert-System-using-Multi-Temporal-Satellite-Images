"""Inference mosaic tests with a tiny ONNX 'model' built by hand (no PyTorch needed)."""

import numpy as np
import pytest
import rasterio

onnx = pytest.importorskip("onnx")
pytest.importorskip("onnxruntime")

from onnx import TensorProto, helper  # noqa: E402

from roadwatch.data.grid import TileKey  # noqa: E402
from roadwatch.data.sentinel2 import tile_transform  # noqa: E402
from roadwatch.models.infer import ModelMeta, OnnxRoadModel, mosaic_predict  # noqa: E402


def _toy_onnx(path, bands=4):
    """logits = 20 * (band0 - 0.5): bright band0 -> road."""
    x = helper.make_tensor_value_info("image", TensorProto.FLOAT, [None, bands, None, None])
    y = helper.make_tensor_value_info("logits", TensorProto.FLOAT, [None, 1, None, None])
    starts = helper.make_tensor("s", TensorProto.INT64, [1], [0])
    ends = helper.make_tensor("e", TensorProto.INT64, [1], [1])
    axes = helper.make_tensor("a", TensorProto.INT64, [1], [1])
    half = helper.make_tensor("h", TensorProto.FLOAT, [], [0.5])
    k = helper.make_tensor("k", TensorProto.FLOAT, [], [20.0])
    nodes = [
        helper.make_node("Slice", ["image", "s", "e", "a"], ["b0"]),
        helper.make_node("Sub", ["b0", "h"], ["d"]),
        helper.make_node("Mul", ["d", "k"], ["logits"]),
    ]
    g = helper.make_graph(nodes, "toy", [x], [y], initializer=[starts, ends, axes, half, k])
    onnx.save(helper.make_model(g, opset_imports=[helper.make_opsetid("", 17)], ir_version=8), path)


def _tile(tmp, key: TileKey, road_row: int | None):
    a = np.full((4, key.size_px, key.size_px), 40, np.uint8)
    if road_row is not None:
        a[0, road_row - 1:road_row + 2, :] = 250
    p = tmp / f"{key.tile_id}.tif"
    with rasterio.open(p, "w", driver="GTiff", width=key.size_px, height=key.size_px, count=4,
                       dtype="uint8", crs=f"EPSG:{key.epsg}", transform=tile_transform(key)) as d:
        d.write(a)
    return p


def test_mosaic_places_tiles_and_predicts(tmp_path):
    _toy_onnx(tmp_path / "m.onnx")
    model = OnnxRoadModel(tmp_path / "m.onnx", ModelMeta(mean=[0] * 4, std=[1] * 4, bands=["b"] * 4))
    left, right = TileKey(32644, 10.0, 64, 10, 20), TileKey(32644, 10.0, 64, 11, 20)
    paths = {left.tile_id: _tile(tmp_path, left, 32), right.tile_id: _tile(tmp_path, right, None)}
    prob, t, crs, valid = mosaic_predict(model, paths)
    assert prob.shape == (64, 128) and crs == "EPSG:32644" and valid.all()
    assert prob[32, :64].min() > 0.99            # road row in the left tile
    assert prob[:, 64:].max() < 0.01             # right tile has no road
    assert t == tile_transform(left)             # mosaic origin = top-left tile
