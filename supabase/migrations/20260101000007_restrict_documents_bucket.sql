-- The documents bucket had no size/type limits, letting any authenticated
-- user upload arbitrarily large or arbitrarily typed files (storage-cost
-- abuse vector). Cap it to what a challan receipt, Form 16B/141, or a
-- scanned PAN/ID actually is.
update storage.buckets
set
  file_size_limit = 15728640, -- 15 MB
  allowed_mime_types = array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'text/plain'
  ]
where id = 'documents';
