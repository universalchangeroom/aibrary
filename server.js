import express from "express";
import parserRouter from "./parserService.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Parse JSON request bodies (required for POST /api/import-link)
app.use(express.json());

// Register import/parser routes from parserService.js
app.use(parserRouter);

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
