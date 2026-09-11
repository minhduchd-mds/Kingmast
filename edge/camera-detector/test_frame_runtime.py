from frame_runtime import LatestFrameBuffer


def test_latest_frame_buffer_drops_oldest_when_full() -> None:
    buffer = LatestFrameBuffer(capacity=2)
    assert buffer.push('frame-1', 1000)
    assert buffer.push('frame-2', 1010)
    assert buffer.push('frame-3', 1020)

    latest = buffer.get_latest(0)
    assert latest is not None
    assert latest.frame == 'frame-3'
    assert latest.captured_at_ms == 1020
    assert buffer.captured == 3
    assert buffer.dropped == 2
    assert buffer.depth == 0


def test_latest_frame_buffer_rejects_invalid_capacity() -> None:
    for capacity in (0, 9):
        try:
            LatestFrameBuffer(capacity=capacity)
        except ValueError:
            pass
        else:
            raise AssertionError('invalid capacity must fail closed')


def test_closed_buffer_does_not_accept_new_frames() -> None:
    buffer = LatestFrameBuffer(capacity=1)
    buffer.close()
    assert buffer.push('frame') is False
    assert buffer.get_latest(0) is None
