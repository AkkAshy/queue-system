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
