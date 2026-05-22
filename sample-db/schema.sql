-- Sample bookstore database.
-- Written against the intersection of PostgreSQL and MySQL syntax so it can
-- be loaded verbatim into either engine.

CREATE TABLE authors (
  id INTEGER PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  country VARCHAR(50)
);

CREATE TABLE books (
  id INTEGER PRIMARY KEY,
  author_id INTEGER NOT NULL,
  title VARCHAR(200) NOT NULL,
  published_year INTEGER,
  price DECIMAL(10, 2),
  FOREIGN KEY (author_id) REFERENCES authors(id)
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  email VARCHAR(100) NOT NULL,
  name VARCHAR(100)
);

CREATE TABLE orders (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL,
  book_id INTEGER NOT NULL,
  quantity INTEGER NOT NULL,
  order_date DATE NOT NULL,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE INDEX idx_books_author ON books(author_id);
CREATE INDEX idx_orders_customer ON orders(customer_id);
CREATE INDEX idx_orders_book ON orders(book_id);
CREATE INDEX idx_orders_date ON orders(order_date);

INSERT INTO authors (id, name, country) VALUES
  (1, 'Italo Calvino', 'Italy'),
  (2, 'Jorge Luis Borges', 'Argentina'),
  (3, 'Haruki Murakami', 'Japan'),
  (4, 'Margaret Atwood', 'Canada'),
  (5, 'Ursula K Le Guin', 'United States');

INSERT INTO books (id, author_id, title, published_year, price) VALUES
  (1, 1, 'Invisible Cities', 1972, 14.99),
  (2, 1, 'If on a Winters Night a Traveler', 1979, 16.50),
  (3, 2, 'Ficciones', 1944, 12.00),
  (4, 2, 'The Aleph', 1949, 13.50),
  (5, 3, 'Kafka on the Shore', 2002, 18.99),
  (6, 3, 'Norwegian Wood', 1987, 17.25),
  (7, 4, 'The Handmaids Tale', 1985, 15.00),
  (8, 5, 'The Left Hand of Darkness', 1969, 14.50);

INSERT INTO customers (id, email, name) VALUES
  (1, 'alice@example.com', 'Alice'),
  (2, 'bob@example.com', 'Bob'),
  (3, 'carla@example.com', 'Carla'),
  (4, 'dario@example.com', 'Dario');

INSERT INTO orders (id, customer_id, book_id, quantity, order_date) VALUES
  (1, 1, 1, 1, '2026-01-15'),
  (2, 1, 5, 2, '2026-02-03'),
  (3, 2, 3, 1, '2026-02-10'),
  (4, 3, 7, 1, '2026-03-01'),
  (5, 2, 2, 1, '2026-03-15'),
  (6, 4, 8, 3, '2026-04-02'),
  (7, 1, 6, 1, '2026-04-18'),
  (8, 3, 4, 2, '2026-05-05');
