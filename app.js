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
        // await mongoClient.connect();

        const participants = await db
            .collection("participants")
            .find()
            .toArray();
        res.send(participants);

        // mongoClient.close();
    } catch (error) {
        console.log(error);
        res.sendStatus(500);

        // mongoClient.close();
    }
});

app.get("/messages", async (req, res) => {
    try {
        // await mongoClient.connect();

        const messages = await db.collection("messages").find().toArray();
        res.send(messages);

        // mongoClient.close();
    } catch (error) {
        console.log(error);
        res.sendStatus(500);

        // mongoClient.close();
    }
});

app.post("/participants", async (req, res) => {
    const { name } = req.body;
    await mongoClient.connect();

    let participant = await db
        .collection("participants")
        .findOne({ name: name });

    // await mongoClient.close();
    if (participant) {
        res.sendStatus(409);
    } else {
        participant = {
            name,
            lastStatus: Date.now(),
        };

        try {
            // await mongoClient.connect();
            await db.collection("participants").insertOne(participant);

            const message = {
                from: name,
                to: "Todos",
                text: "entra na sala...",
                type: "status",
                time: dayjs().format("HH:mm:ss"),
            };

            await db.collection("messages").insertOne(message);

            // mongoClient.close();

            res.sendStatus(201);
        } catch (error) {
            res.sendStatus(500);
            // mongoClient.close();
        }
    }
});

app.post("/messages", async (req, res) => {
    const { to, text, type } = req.body;
    const from = req.headers.user;

    const message = {
        to,
        from,
        text,
        type,
        time: dayjs().format("HH:mm:ss"),
    };

    try {
        // await mongoClient.connect();

        await db.collection("messages").insertOne(message);

        res.sendStatus(201);

        // mongoClient.close();
    } catch (e) {
        res.sendStatus(500);
    }
});

app.post("/status", async (req, res) => {
    const name = req.headers.user;

    let participant = await db
        .collection("participants")
        .findOne({ name: name });
    if (!participant) {
        res.sendStatus(404);
    } else {
        try {
            db.collection("participants").updateOne(participant, {
                $set: { lastStatus: Date.now() },
            });

            res.sendStatus(200);
        } catch {
            res.sendStatus(500);
        }
    }
});

app.listen(5000, () =>
    console.log(chalk.green("Server listening on port 5000"))
);

async function checkActiveParticipants() {
    try {
        const participants = await db.collection("participants").find({})
            .toArray();
        for (let i = 0; i < participants.length; i++) {
            if (Date.now() - participants[i].lastStatus > 10000) {
                await db.collection("participants").deleteOne(participants[i]);
                await db.collection("messages").insertOne({
                    from: participants[i].name,
                    to: "Todos",
                    text: "sai da sala...",
                    type: "status",
                    time: dayjs().format("HH:mm:ss"),
                });
            }
        }
    } catch (error) {
        console.log(chalk.red(error));
    }
}

const intervalo = setInterval(checkActiveParticipants, 15000);
