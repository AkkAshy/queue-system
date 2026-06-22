import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.db import IntegrityError, transaction

from queue_app.models import VoiceClip

pytestmark = pytest.mark.django_db


def _mp3(name="c.mp3", content=b"ID3\x03\x00fake-audio-bytes"):
    return SimpleUploadedFile(name, content, content_type="audio/mpeg")


def test_voice_clip_path_is_deterministic(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    clip = VoiceClip.objects.create(kind="num", key="5", file=_mp3())
    assert clip.file.name == "voice/num_5.mp3"


def test_voice_clip_unique_per_slot(settings, tmp_path):
    settings.MEDIA_ROOT = tmp_path
    VoiceClip.objects.create(kind="letter", key="A", file=_mp3("a.mp3"))
    with pytest.raises(IntegrityError):
        with transaction.atomic():  # держим транзакцию чистой для teardown
            VoiceClip.objects.create(kind="letter", key="A", file=_mp3("a2.mp3"))


def test_voice_clips_get_is_public(settings, tmp_path, client, seeded):
    settings.MEDIA_ROOT = tmp_path
    assert client.get("/api/display/voice-clips").json() == []


def test_voice_clip_upload_requires_chief(settings, tmp_path, client, seeded):
    settings.MEDIA_ROOT = tmp_path
    r = client.post(
        "/api/display/voice-clips",
        {"kind": "num", "key": "5", "file": _mp3()},
        format="multipart",
    )
    assert r.status_code in (401, 403)


def test_voice_clip_upload_and_list(settings, tmp_path, auth_client):
    settings.MEDIA_ROOT = tmp_path
    r = auth_client.post(
        "/api/display/voice-clips",
        {"kind": "num", "key": "5", "file": _mp3()},
        format="multipart",
    )
    assert r.status_code == 201, r.content
    body = r.json()
    assert body["kind"] == "num" and body["key"] == "5"
    assert body["url"].endswith("/voice/num_5.mp3")
    assert "id" in body and "updated_at" in body
    assert body["enabled"] is True
    assert len(auth_client.get("/api/display/voice-clips").json()) == 1


def test_voice_clip_upsert_replaces_same_slot(settings, tmp_path, auth_client):
    settings.MEDIA_ROOT = tmp_path
    auth_client.post(
        "/api/display/voice-clips",
        {"kind": "num", "key": "5", "file": _mp3("a.mp3")},
        format="multipart",
    )
    auth_client.post(
        "/api/display/voice-clips",
        {"kind": "num", "key": "5", "file": _mp3("b.mp3")},
        format="multipart",
    )
    assert len(auth_client.get("/api/display/voice-clips").json()) == 1


def test_voice_clip_toggle_enabled(settings, tmp_path, auth_client):
    settings.MEDIA_ROOT = tmp_path
    r = auth_client.post(
        "/api/display/voice-clips",
        {"kind": "num", "key": "5", "file": _mp3()},
        format="multipart",
    )
    cid = r.json()["id"]
    assert r.json()["enabled"] is True
    p = auth_client.patch(
        f"/api/display/voice-clips/{cid}", {"enabled": False}, format="json"
    )
    assert p.status_code == 200 and p.json()["enabled"] is False
    assert auth_client.get("/api/display/voice-clips").json()[0]["enabled"] is False


def test_voice_clip_rejects_non_mp3(settings, tmp_path, auth_client):
    settings.MEDIA_ROOT = tmp_path
    bad = SimpleUploadedFile("x.txt", b"hello", content_type="text/plain")
    r = auth_client.post(
        "/api/display/voice-clips",
        {"kind": "num", "key": "5", "file": bad},
        format="multipart",
    )
    assert r.status_code == 400


def test_voice_clip_delete(settings, tmp_path, auth_client):
    settings.MEDIA_ROOT = tmp_path
    r = auth_client.post(
        "/api/display/voice-clips",
        {"kind": "window", "key": "5", "file": _mp3()},
        format="multipart",
    )
    cid = r.json()["id"]
    assert auth_client.delete(f"/api/display/voice-clips/{cid}").status_code == 204
    assert auth_client.get("/api/display/voice-clips").json() == []
