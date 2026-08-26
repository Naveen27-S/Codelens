-- Run this script as MySQL root to set up the CodeLens AI database.
-- Command: mysql -u root -p < setup_mysql.sql

-- Create database
CREATE DATABASE IF NOT EXISTS codelens_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Create dedicated application user
CREATE USER IF NOT EXISTS 'codelens_user'@'localhost' IDENTIFIED BY 'C8!vQ2#nL7@xR5$kM9%pT4';

-- Grant all privileges on the codelens database
GRANT ALL PRIVILEGES ON codelens_db.* TO 'codelens_user'@'localhost';

FLUSH PRIVILEGES;

-- Verify
SHOW DATABASES;
SELECT User, Host FROM mysql.user WHERE User = 'codelens_user';
