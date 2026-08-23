from django.conf import settings
from django.core.files.uploadhandler import StopUpload, TemporaryFileUploadHandler


class BoundedTemporaryFileUploadHandler(TemporaryFileUploadHandler):
    """Stream uploads to disk and stop reading once the product byte limit is crossed."""

    def new_file(self, *args, **kwargs) -> None:
        super().new_file(*args, **kwargs)
        self._received_bytes = 0

    def receive_data_chunk(self, raw_data: bytes, start: int) -> bytes | None:
        self._received_bytes += len(raw_data)
        if self._received_bytes > settings.CASE_EVIDENCE_MAX_BYTES:
            raise StopUpload(connection_reset=True)
        return super().receive_data_chunk(raw_data, start)
