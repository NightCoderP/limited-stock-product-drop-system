#  Limited Stock Reservation System

##  Overview

This project is a backend system designed to handle **limited stock product drops** with safe reservation, checkout, and expiration logic.

It prevents **overselling**, supports **concurrent requests**, and maintains an **audit trail of stock changes**.

---

##  Features

###  Product Management
- List products with pagination, filtering, and sorting
- Stock tracking (`totalStock`, `availableStock`)

###  Reservation System
- Reserve products with expiration time
- Prevent duplicate active reservations per user
- Safe stock decrement using database transactions

###  Checkout Flow
- Complete reservations before expiration
- Validate reservation status and expiration

###  Expiration & Cleanup
- Automatically expire stale reservations
- Restore stock after expiration
- Background cleanup job (runs every minute)

###  Inventory Logging (Audit Trail)
Tracks all stock movements:
- `RESERVE` → stock decrease
- `CHECKOUT` → event log
- `EXPIRE` → stock restore

###  API Enhancements
- Request validation with **Zod**
- Global error handling middleware
- Structured request logging
- Health check endpoint
- Pagination, filtering, sorting

###  Security
- Duplicate reservation protection
- CORS enabled
- Safe transactional updates

---

##  Tech Stack

- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod

---

##  Installation

```bash
git clone <repo-url>
cd backend
npm install
```

---

##  Setup Database

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

---

##  Run the Server

```bash
npm run dev
```

Server runs on:
```
http://localhost:3001
```

---

## 📡 API Endpoints

### Health Check
```
GET /health
```

---

### Get Products
```
GET /products?page=1&limit=10&inStock=true&sortBy=createdAt&order=desc
```

---

### Reserve Product
```
POST /reserve
```

```json
{
  "productId": "PRODUCT_ID",
  "quantity": 1,
  "userId": "user-1"
}
```

---

### Checkout Reservation
```
POST /checkout
```

```json
{
  "reservationId": "RESERVATION_ID"
}
```

---

### Cleanup Expired Reservations
```
POST /cleanup
```

---

##  System Flow

1. User reserves a product → stock decreases  
2. User completes checkout → reservation marked as completed  
3. If user does not checkout → reservation expires  
4. Expired reservations restore stock automatically  

---

##  Example Scenarios

###  Successful Reservation
- Stock decreases
- Reservation created
- Inventory log recorded

###  Not Enough Stock
- Request rejected safely

###  Duplicate Reservation
- Same user cannot reserve same product twice

###  Expired Reservation
- Automatically marked as expired
- Stock restored

---

## 📊 Logging Example

```json
{
  "productId": "xxx",
  "change": -1,
  "reason": "RESERVE"
}
```

---

##  Key Concepts

- Optimistic concurrency control
- Database transactions
- Stock consistency
- Reservation lifecycle management
- Audit logging

---

##  Future Improvements

- Rate limiting
- Metrics endpoint
- Authentication system
- Frontend integration
- Deployment (Docker / Cloud)

---

##  Author

Backend system built as part of a limited stock drop system simulation.

---

##  Closing Note

This project demonstrates how to build a **real-world backend system** that safely handles:
- concurrent users
- limited inventory
- time-based reservations
