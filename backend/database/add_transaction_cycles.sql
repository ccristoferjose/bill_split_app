-- Track monthly cycle payments for recurring transaction bills
CREATE TABLE IF NOT EXISTS transaction_cycle_payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_id INT NOT NULL,
  user_id INT NOT NULL,
  cycle_year SMALLINT NOT NULL,
  cycle_month TINYINT NOT NULL,
  paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_cycle (transaction_id, user_id, cycle_year, cycle_month),
  FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
);
