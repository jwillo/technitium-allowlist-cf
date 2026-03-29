import test from "node:test";
import assert from "node:assert/strict";
import worker from "../src/worker.js";

class FakeR2Object {
  constructor(value) {
    this.value = value;
  }

  async text() {
    return this.value;
  }
}

class FakeR2Bucket {
  constructor() {
    this.store = new Map();
  }

  async get(key) {
    if (!this.store.has(key)) {
      return null;
    }
    return new FakeR2Object(this.store.get(key));
  }

  async put(key, value) {
    this.store.set(key, value);
  }
}

function buildEnv() {
  return {
    ALLOWLIST_OBJECT_KEY: "allowlist.txt",
    ALLOWLIST_BUCKET: new FakeR2Bucket(),
  };
}

async function jsonResponse(res) {
  const body = await res.text();
  return JSON.parse(body);
}

test("GET /api/domains seeds with jdcf.cc when empty", async () => {
  const env = buildEnv();

  const res = await worker.fetch(new Request("https://example.com/api/domains"), env);
  assert.equal(res.status, 200);

  const payload = await jsonResponse(res);
  assert.deepEqual(payload.domains, ["jdcf.cc"]);
});

test("POST and DELETE domain update allowlist", async () => {
  const env = buildEnv();

  const addRes = await worker.fetch(
    new Request("https://example.com/api/domains", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: "example.com" }),
    }),
    env
  );

  assert.equal(addRes.status, 201);

  const listAfterAddRes = await worker.fetch(new Request("https://example.com/api/domains"), env);
  const listAfterAdd = await jsonResponse(listAfterAddRes);
  assert.deepEqual(listAfterAdd.domains, ["example.com", "jdcf.cc"]);

  const deleteRes = await worker.fetch(
    new Request("https://example.com/api/domains", {
      method: "DELETE",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ domain: "example.com" }),
    }),
    env
  );

  assert.equal(deleteRes.status, 200);

  const listAfterDeleteRes = await worker.fetch(new Request("https://example.com/api/domains"), env);
  const listAfterDelete = await jsonResponse(listAfterDeleteRes);
  assert.deepEqual(listAfterDelete.domains, ["jdcf.cc"]);
});

test("GET /allowlist.txt returns ABP format", async () => {
  const env = buildEnv();

  const res = await worker.fetch(new Request("https://example.com/allowlist.txt"), env);
  assert.equal(res.status, 200);

  const text = await res.text();
  assert.match(text, /^\[Adblock Plus 2.0\]/);
  assert.match(text, /@@\|\|jdcf\.cc\^/);
});

test("GET / contains table UI and fixed allowlist URL area", async () => {
  const env = buildEnv();

  const res = await worker.fetch(new Request("https://example.com/"), env);
  assert.equal(res.status, 200);

  const html = await res.text();
  assert.match(html, /Allowlist URL to use in Technitium/);
  assert.match(html, /<table>/);
  assert.match(html, /Show Existing/);
  assert.match(html, /Delete/);
});
