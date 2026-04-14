#  Limited Stock Reservation System

##  Overview

This project is a full-stack system designed to handle **limited stock product drops** with safe reservation, checkout, and expiration logic.

It prevents **overselling**, handles **concurrent users**, and provides a complete **reservation lifecycle with audit logging**.

---

##  Features

###  Product Management
- List products with pagination, filtering, and sorting
- Track `totalStock` and `availableStock`

###  Reservation System
- Reserve products with expiration time (5 minutes)
- Prevent duplicate active reservations per user
- Safe stock decrement using database transactions

###  Checkout Flow
- Complete reservations before expiration
- Validate reservation status and expiration
- Update reservation status to `COMPLETED`

###  Expiration & Cleanup
- Automatically expire stale reservations
- Restore stock after expiration
- Background cleanup job runs every minute

###  Inventory Logging (Audit Trail)
Tracks all stock changes:
- `RESERVE` → stock decreases
- `CHECKOUT` → event recorded
- `EXPIRE` → stock restored

###  Frontend Features
- Product listing UI
- Real-time stock display
- Reserve button with loading state
- Countdown timer for reservation expiration
- Checkout button for completing reservations
- Error and success feedback

---

##  Tech Stack

### Backend
- Node.js
- Express
- TypeScript
- Prisma ORM
- PostgreSQL
- Zod (validation)

### Frontend
- React
- TypeScript
- Vite
- Axios

---

##  Installation

### Clone repository

```bash
git clone <repo-url>
cd project-folder
```

---

### Backend setup

```bash
cd backend
npm install
```

```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

```bash
npm run dev
```

Backend runs on:
```
http://localhost:3001
```

---

### Frontend setup

```bash
cd frontend
npm install
```

Create `.env` file:

```env
VITE_API_URL=http://localhost:3001
```

```bash
npm run dev
```

Frontend runs on:
```
http://localhost:5173
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
2. Countdown starts (5 minutes)  
3. User completes checkout → reservation marked as `COMPLETED`  
4. If not completed → reservation expires  
5. Expired reservations restore stock automatically  

---

##  Example Scenarios

###  Successful Reservation
- Stock decreases
- Reservation created
- Countdown starts

###  Not Enough Stock
- Request rejected safely

###  Duplicate Reservation
- Same user cannot reserve same product twice

### ⏳ Expired Reservation
- Reservation marked as `EXPIRED`
- Stock restored automatically

---

##  Logging Example

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

##  Security

- Duplicate reservation protection
- Safe transactional updates
- Input validation with Zod
- Basic CORS configuration

---

##  Future Improvements

- Rate limiting
- Metrics endpoint
- Authentication system
- Persistent frontend state
- Deployment (Docker / Cloud)

---

## 👨 Author

Developed as a **limited stock drop system simulation** demonstrating real-world backend logic and frontend integration.

---

##  Final Note

This project demonstrates how to build a **real-world system** that safely handles:

- concurrent users  
- limited inventory  
- time-based reservations  

with full lifecycle management and frontend integration.