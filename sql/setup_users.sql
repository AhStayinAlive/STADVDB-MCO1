CREATE DATABASE IF NOT EXISTS dw_mco
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;
CREATE DATABASE IF NOT EXISTS src_mco
  CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci;

-- make sure the dw accounts exist (safe if already there)
CREATE USER IF NOT EXISTS 'dw'@'127.0.0.1' IDENTIFIED BY 'DwPass!123';
CREATE USER IF NOT EXISTS 'dw'@'localhost'  IDENTIFIED BY 'DwPass!123';

-- grant dw full rights on the two databases
GRANT ALL PRIVILEGES ON dw_mco.*  TO 'dw'@'127.0.0.1';
GRANT ALL PRIVILEGES ON dw_mco.*  TO 'dw'@'localhost';
GRANT ALL PRIVILEGES ON src_mco.* TO 'dw'@'127.0.0.1';
GRANT ALL PRIVILEGES ON src_mco.* TO 'dw'@'localhost';
FLUSH PRIVILEGES;

-- verify
SHOW GRANTS FOR 'dw'@'127.0.0.1';
SHOW GRANTS FOR 'dw'@'localhost';
