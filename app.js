import express from "express";
import chalk from "chalk";
import cors from "cors";

const app = express();

app.use(express.json());
app.use(cors());



app.listen(5000, () => console.log(chalk.green("Server listening on port 5000")));