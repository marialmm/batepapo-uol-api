import express from "express";
import chalk from "chalk";
import cors from "cors";
import dayjs from "dayjs";
import { MongoClient } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => (db = mongoClient.db("batepapo-uol")));

const app = express();

app.use(express.json());
app.use(cors());

app.get("/participants", async (req, res) => {
    try {
        await mongoClient.connect();

        const participants = await db
            .collection("participants")
            .find()
            .toArray();
        res.send(participants);

        mongoClient.close();
    } catch (error) {
        console.log(error);
        res.sendStatus(500);

        mongoClient.close();
    }
});

app.get("/messages", async (req, res) => {
    try {
        await mongoClient.connect();

        const messages = await db
            .collection("messages")
            .find()
            .toArray();
        res.send(messages);

        mongoClient.close();
    } catch (error) {
        console.log(error);
        res.sendStatus(500);

        mongoClient.close();
    }
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    await mongoClient.connect();

    let participant = await db.collection("participants").findOne({ name: name });

    await mongoClient.close();
    if (participant) {
        res.sendStatus(409);
    } else {
        participant = {
            name,
            lastStatus: Date.now(),
        };

        try {
            await mongoClient.connect();
            await db.collection("participants").insertOne(participant);

            const message = {
                from: name,
                to: "Todos",
                text: "entra na sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss"),
            };

            await db.collection("messages").insertOne(message);

            mongoClient.close();

            res.sendStatus(201);
        } catch (error) {
            res.sendStatus(500);
            mongoClient.close();
        }
    }
});

app.post("/messages", (req, res) => {
    res.sendStatus(201);
});

app.post("/status", (req, res) => {
    res.sendStatus(201);
});

app.listen(5000, () =>
    console.log(chalk.green("Server listening on port 5000"))
);
