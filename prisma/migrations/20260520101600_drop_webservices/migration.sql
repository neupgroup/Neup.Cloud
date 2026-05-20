-- Drop legacy webservices persistence. Nginx configurations are now managed directly on Linux files.
DROP TABLE IF EXISTS "webservices";
