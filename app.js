import chalk from "chalk";
import cors from "cors";
import dayjs from "dayjs";
import dotenv from "dotenv";
import express from "express";
import joi from "joi";
import { MongoClient, ObjectId } from "mongodb";
import { stripHtml } from "string-strip-html";

dotenv.config();

const mongoClient = new MongoClient(process.env.MONGO_URI);
let db;
mongoClient.connect(() => (db = mongoClient.db("batepapo-uol")));

const app = express();

app.use(express.json());
app.use(cors());

const participantSchema = joi.object({
    name: joi.string().required().trim(),
});

const messageSchema = joi.object({
    to: joi.string().required().trim(),
    text: joi.string().required().trim(),
    type: joi.any().valid("message", "private_message"),
});

app.get("/participants", async (req, res) => {
    try {
        const participants = await db
            .collection("participants")
            .find()
            .toArray();
        res.send(participants);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.get("/messages", async (req, res) => {
    const limit = req.query.limit;
    const user = req.headers.user;

    try {
        let messages = await db
            .collection("messages")
            .find({
                $or: [
                    { type: "message" },
                    { to: "Todos" },
                    { to: user },
                    { from: user },
                ],
            })
            .toArray();
        if (limit && limit <= messages.length) {
            messages = messages.slice(limit * -1);
        }

        res.send(messages);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.post("/participants", async (req, res) => {
    const validation = participantSchema.validate(req.body);

    if (validation.error) {
        console.log(validation.error.details);
        res.sendStatus(422);
        return;
    }
    let { name } = req.body;

    name = stripHtml(name).result;

    await mongoClient.connect();

    let participant = await db
        .collection("participants")
        .findOne({ name: name });
    if (participant) {
        res.sendStatus(409);
        return;
    }

    participant = {
        name,
        lastStatus: Date.now(),
    };

    try {
        await db.collection("participants").insertOne(participant);

        const message = {
            from: name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: dayjs().format("HH:mm:ss"),
        };

        await db.collection("messages").insertOne(message);

        res.sendStatus(201);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.post("/messages", async (req, res) => {
    const validation = messageSchema.validate(req.body);

    const user = await db
        .collection("participants")
        .findOne({ name: req.headers.user });

    if (!user || validation.error) {
        console.log(validation.error.details.map((detail) => detail.message));
        res.sendStatus(422);

        return;
    }
    const { to, text, type } = req.body;
    const from = req.headers.user;

    let message = {
        to: stripHtml(to).result,
        from: stripHtml(from).result,
        text: stripHtml(text).result,
        type: stripHtml(type).result,
        time: dayjs().format("HH:mm:ss"),
    };

    try {
        await db.collection("messages").insertOne(message);

        res.sendStatus(201);
    } catch (e) {
        console.log(e);
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
    }
    try {
        db.collection("participants").updateOne(participant, {
            $set: { lastStatus: Date.now() },
        });

        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.delete("/messages/:idMessage", async (req, res) => {
    const idMessage = req.params.idMessage;
    const user = req.headers.user;

    try {
        const message = await db
            .collection("messages")
            .findOne({ _id: new ObjectId(idMessage) });
        console.log(message);
        if (!message) {
            res.sendStatus(404);
            return;
        } else if (message.from !== user) {
            res.sendStatus(401);
            return;
        }

        await db.collection("messages").deleteOne(message);

        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.put("/messages/:idMessage", async (req, res) => {
    const validation = messageSchema.validate(req.body, { abortEarly: false });
    const { idMessage } = req.params;
    const from = req.headers.user;

    if (validation.error) {
        res.sendStatus(422);
        console.log(validation.error.details.map((detail) => detail.message));
        return;
    }

    try {
        const message = await db
            .collection("messages")
            .findOne({ _id: new ObjectId(idMessage) });
        const user = await db
            .collection("participants")
            .findOne({ name: from });

        if (!message || !user) {
            res.sendStatus(404);
            return;
        } else if (message.from !== from) {
            res.sendStatus(401);
            return;
        }

        const newMessage = {
            to: stripHtml(req.body.to).result,
            from: stripHtml(from).result,
            text: stripHtml(req.body.text).result,
            type: stripHtml(req.body.type).result,
        };

        await db
            .collection("messages")
            .updateOne({ _id: new ObjectId(idMessage) }, { $set: newMessage });

        res.sendStatus(200);
    } catch (e) {
        console.log(e);
        res.sendStatus(500);
    }
});

app.listen(5000, () =>
    console.log(chalk.green("Server listening on port 5000"))
);

async function removeInactiveParticipants() {
    try {
        const participants = await db
            .collection("participants")
            .find({})
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
    } catch (e) {
        console.log(e);
    }
};

const intervalo = setInterval(removeInactiveParticipants, 15000);