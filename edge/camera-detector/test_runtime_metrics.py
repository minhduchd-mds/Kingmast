from runtime_metrics import RollingLatency


def test_rolling_latency_tracks_percentiles() -> None:
    metrics = RollingLatency(max_samples=8)
    for value in (10, 20, 30, 40, 50, 60, 70, 80):
        metrics.observe(value)
    snapshot = metrics.snapshot()
    assert snapshot['samples'] == 8
    assert snapshot['p50Ms'] == 40
    assert snapshot['p95Ms'] == 80
    assert snapshot['latestMs'] == 80


def test_rolling_latency_discards_invalid_samples_and_bounds_history() -> None:
    metrics = RollingLatency(max_samples=8)
    metrics.observe(float('nan'))
    metrics.observe(-1)
    for value in range(20):
        metrics.observe(value)
    snapshot = metrics.snapshot()
    assert snapshot['samples'] == 8
    assert snapshot['latestMs'] == 19
    assert snapshot['averageMs'] == 15.5
