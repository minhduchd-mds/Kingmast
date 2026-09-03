INSERT INTO vehicles(vin_hash,profile_name) VALUES (encode(digest('DEMO-VIN','sha256'),'hex'),'Electric SUV Demo') ON CONFLICT DO NOTHING;
