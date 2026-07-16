# Pentarium IoT Backend

Backend IoT Platform untuk monitoring perangkat berbasis ESP32 menggunakan:

- Node.js
- Express
- TypeScript
- Prisma
- MySQL
- Mosquitto MQTT

# Running the Project

Open 3 terminals.

### Terminal 1

Backend

```bash
cd pentarium-iot
npm run dev
```

---

### Terminal 2

Frontend

```bash
cd pentarium-frontend
npm run dev
```

---

### Terminal 3

MQTT Simulator

```bash
cd pentarium-iot
npx tsx src/simulate.ts
```

---

Open browser

```
http://localhost:5173
```
