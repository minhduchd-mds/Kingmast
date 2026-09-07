import json
import os
import re
import unicodedata
import urllib.parse
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

PORT = int(os.environ.get("PORT", "10000"))
API_KEY = os.environ.get("ELEVENLABS_API_KEY", "")
VOICE_NAME = os.environ.get("ELEVENLABS_VOICE_NAME", "Tony Hoang")
VOICE_ID_OVERRIDE = os.environ.get("ELEVENLABS_VOICE_ID", "")
MODEL_ID = os.environ.get("ELEVENLABS_MODEL_ID", "eleven_flash_v2_5")
CACHE = Path("/tmp/kingmast-elevenlabs")
CACHE.mkdir(parents=True, exist_ok=True)

SEGMENTS = {
    1: "Mỗi khi bước lên xe, điều quý giá nhất phía sau tay lái không chỉ là điểm đến, mà là sự an toàn trọn vẹn của những người bạn yêu thương.",
    2: "Nhưng liệu chiếc xe hiện tại của bạn đã thực sự đủ thông minh để bảo vệ bạn trước mọi tình huống bất ngờ trên cung đường?",
    3: "Chào mừng bạn đến với KINGMAST, Smart Mobility Safety Platform. Một thiết bị phần cứng độc lập kết hợp nền tảng phần mềm mạnh mẽ, biến bất kỳ chiếc xe thường nào thành một cỗ máy thông minh thế hệ mới.",
    4: "Được tích hợp hệ thống hỗ trợ lái nâng cao ADAS, KINGMAST đóng vai trò như một giác quan thứ sáu nhạy bén: cảnh báo va chạm phía trước FCW và cảnh báo chệch làn đường LDW.",
    5: "KINGMAST hỗ trợ giảm rủi ro từ góc khuất với giám sát điểm mù BSM và phát hiện phương tiện cắt ngang khi lùi RCTA.",
    6: "Hệ thống nhận diện người đi bộ, đọc và cảnh báo biển báo giới hạn tốc độ, đồng thời hỗ trợ lái vững vàng trên hành trình cao tốc HWA.",
    7: "Không gian quanh xe được khai mở với Camera ba trăm sáu mươi độ cùng Camera hành trình bảo vệ liên tục. Đặc biệt, hệ thống DMS theo dõi trạng thái tài xế và cảnh báo khi mất tập trung hoặc có dấu hiệu buồn ngủ.",
    8: "Vượt lên trên một chiếc camera thông thường, KINGMAST kết nối với hạ tầng giao thông qua V2X, cập nhật mật độ giao thông và bản đồ dẫn đường theo thời gian thực.",
    9: "Bên trong khoang lái, công nghệ trở thành người bạn đồng hành. Trợ lý AI xử lý yêu cầu bằng giọng nói, từ điều hòa, âm nhạc, đồng bộ smartphone cho đến Wi-Fi tốc độ cao.",
    10: "Theo dõi sức khỏe xe và trạm sạc xe điện tức thời. Cảnh báo điều kiện thời tiết cực đoan cùng chế độ Eco giúp mỗi chuyến đi luôn vận hành ở trạng thái tối ưu.",
    11: "Với doanh nghiệp và đội xe, nền tảng mang tới công cụ quản lý Fleet toàn diện: chấm điểm hành vi người lái, phân tích dữ liệu chuyên sâu và kết nối với dịch vụ bảo hiểm.",
    12: "Dù ngày hay đêm, xe của bạn luôn được giám sát với Parked Mode. Và trong khoảnh khắc nguy cấp, tính năng eCall hỗ trợ kết nối với sự trợ giúp ngay lập tức.",
    13: "Hệ thống liên tục tiến hóa nhờ cập nhật từ xa OTA, hiệu chuẩn cảm biến, bảo mật dữ liệu và kho ứng dụng mở rộng.",
    14: "KINGMAST. Nâng tầm xe thường, trao gửi trọn vẹn an toàn tương lai. Làm chủ mọi hành trình ngay hôm nay."
}

VOICE_CACHE = {"voice_id": None, "name": None, "source": None}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFKD", s or "")
    s = "".join(ch for ch in s if not unicodedata.combining(ch))
    s = re.sub(r"[^a-z0-9]+", " ", s.lower()).strip()
    return s


def req(url, method="GET", body=None):
    if not API_KEY:
        raise RuntimeError("ELEVENLABS_API_KEY is missing")
    headers = {"xi-api-key": API_KEY, "User-Agent": "KINGMAST-ElevenLabs-Bridge/1.0"}
    data = None
    if body is not None:
        headers["Content-Type"] = "application/json"
        data = json.dumps(body, ensure_ascii=False).encode("utf-8")
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=90) as resp:
        return resp.status, resp.headers, resp.read()


def choose_voice(items):
    if not items:
        return None
    target = norm(VOICE_NAME)
    exact = [v for v in items if norm(v.get("name", "")) == target]
    if exact:
        return exact[0]
    # Prefer Vietnamese male voices whose name resembles Tony/Hoang.
    scored = []
    for v in items:
        n = norm(v.get("name", ""))
        score = 0
        if "tony" in n: score += 4
        if "hoang" in n: score += 4
        labels = v.get("labels") or {}
        lang = str(v.get("language") or labels.get("language") or "").lower()
        gender = str(v.get("gender") or labels.get("gender") or "").lower()
        if lang.startswith("vi") or "vietnam" in lang: score += 2
        if gender == "male": score += 1
        scored.append((score, v))
    scored.sort(key=lambda x: x[0], reverse=True)
    return scored[0][1] if scored and scored[0][0] > 0 else items[0]


def resolve_voice():
    if VOICE_CACHE["voice_id"]:
        return VOICE_CACHE
    if VOICE_ID_OVERRIDE:
        VOICE_CACHE.update(voice_id=VOICE_ID_OVERRIDE, name=VOICE_NAME, source="override")
        return VOICE_CACHE

    q = urllib.parse.urlencode({"search": VOICE_NAME, "page_size": 100})
    status, _, raw = req("https://api.elevenlabs.io/v2/voices?" + q)
    data = json.loads(raw.decode("utf-8"))
    picked = choose_voice(data.get("voices", []))
    if picked:
        VOICE_CACHE.update(voice_id=picked.get("voice_id"), name=picked.get("name"), source="my_voices")
        return VOICE_CACHE

    q = urllib.parse.urlencode({"search": VOICE_NAME, "language": "vi", "page_size": 100})
    status, _, raw = req("https://api.elevenlabs.io/v1/shared-voices?" + q)
    data = json.loads(raw.decode("utf-8"))
    picked = choose_voice(data.get("voices", []))
    if not picked:
        raise RuntimeError(f"Voice '{VOICE_NAME}' was not found in My Voices or Voice Library")

    public_owner_id = picked.get("public_owner_id")
    voice_id = picked.get("voice_id")
    if public_owner_id and voice_id:
        try:
            _, _, add_raw = req(
                f"https://api.elevenlabs.io/v1/voices/add/{urllib.parse.quote(public_owner_id)}/{urllib.parse.quote(voice_id)}",
                method="POST",
                body={"new_name": VOICE_NAME, "bookmarked": True},
            )
            added = json.loads(add_raw.decode("utf-8"))
            voice_id = added.get("voice_id") or voice_id
        except Exception:
            pass
    VOICE_CACHE.update(voice_id=voice_id, name=picked.get("name"), source="voice_library")
    return VOICE_CACHE


def generate_segment(index: int) -> Path:
    if index not in SEGMENTS:
        raise KeyError(index)
    out = CACHE / f"segment_{index:02d}.mp3"
    if out.exists() and out.stat().st_size > 1024:
        return out
    voice = resolve_voice()
    voice_id = voice["voice_id"]
    text = SEGMENTS[index]
    url = f"https://api.elevenlabs.io/v1/text-to-speech/{urllib.parse.quote(voice_id)}?output_format=mp3_44100_128"
    body = {
        "text": text,
        "model_id": MODEL_ID,
        "voice_settings": {
            "stability": 0.68,
            "similarity_boost": 0.86,
            "style": 0.10,
            "use_speaker_boost": True
        }
    }
    _, _, audio = req(url, method="POST", body=body)
    out.write_bytes(audio)
    return out


class Handler(BaseHTTPRequestHandler):
    def send_json(self, code, obj):
        b = json.dumps(obj, ensure_ascii=False).encode("utf-8")
        self.send_response(code)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(b)))
        self.end_headers()
        self.wfile.write(b)

    def do_GET(self):
        try:
            parsed = urllib.parse.urlparse(self.path)
            path = parsed.path
            if path == "/health":
                self.send_json(200, {"ok": True, "service": "kingmast-elevenlabs-bridge", "model": MODEL_ID})
                return
            if path == "/meta":
                v = resolve_voice()
                self.send_json(200, {"ok": True, "voice": v, "segments": len(SEGMENTS), "model": MODEL_ID})
                return
            m = re.fullmatch(r"/audio/(\d{1,2})\.mp3", path)
            if m:
                idx = int(m.group(1))
                f = generate_segment(idx)
                data = f.read_bytes()
                self.send_response(200)
                self.send_header("Content-Type", "audio/mpeg")
                self.send_header("Content-Length", str(len(data)))
                self.send_header("Cache-Control", "public, max-age=86400")
                self.end_headers()
                self.wfile.write(data)
                return
            self.send_json(404, {"ok": False, "error": "not found"})
        except Exception as e:
            self.send_json(500, {"ok": False, "error": type(e).__name__, "message": str(e)[:500]})

    def log_message(self, format, *args):
        print("bridge", self.address_string(), format % args, flush=True)


if __name__ == "__main__":
    server = ThreadingHTTPServer(("0.0.0.0", PORT), Handler)
    print(f"KINGMAST ElevenLabs bridge listening on {PORT}", flush=True)
    server.serve_forever()
