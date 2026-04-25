import { MongoClient } from "mongodb";
import { NextResponse } from "next/server";

const uri = process.env.MONGODB_URI!;

let cachedClient: MongoClient | null = null;

async function getClient() {
  if (!cachedClient) {
    cachedClient = new MongoClient(uri);
    await cachedClient.connect();
  }
  return cachedClient;
}

export async function POST(request: Request) {
  const { email } = await request.json();

  if (!email || typeof email !== "string") {
    return NextResponse.json({ error: "Email is required" }, { status: 400 });
  }

  try {
    const client = await getClient();
    const db = client.db("overdrive");
    const collection = db.collection("waitlist");

    const exists = await collection.findOne({ email });
    if (exists) {
      return NextResponse.json({ message: "You're already on the waitlist!" });
    }

    await collection.insertOne({ email, joinedAt: new Date() });
    return NextResponse.json({ message: "You're on the list!" });
  } catch (err) {
    console.error("Waitlist API error:", err);
    cachedClient = null;
    return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
  }
}
