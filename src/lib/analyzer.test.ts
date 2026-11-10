import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildPhraseIndex, extractSentence, findPhrases, lemmaCandidates } from "./analyzer.js";

const ENTRIES = [
  "kick the bucket",
  "break the ice",
  "ice",
  "spill the beans",
  "cry over spilled milk",
  "lose one's temper",
  "pull someone's leg",
  "steal someone's thunder",
  "wild-goose chase",
  "soapbox",
  "piece of cake",
  "hold one's horses",
  "make ends meet",
].map((word, i) => ({ id: `w${i}`, word }));

const index = buildPhraseIndex(ENTRIES);

/** 결과를 [표제어, 원문에 쓰인 형태]로만 줄여서 비교한다 */
const found = (text: string) => findPhrases(text, index).map((m) => [m.word, m.matchedText]);

describe("findPhrases", () => {
  it("활용형을 같은 숙어로 찾는다", () => {
    assert.deepEqual(found("My old printer finally kicked the bucket."), [["kick the bucket", "kicked the bucket"]]);
    assert.deepEqual(found("Who is kicking the bucket?"), [["kick the bucket", "kicking the bucket"]]);
    assert.deepEqual(found("She kicks the bucket"), [["kick the bucket", "kicks the bucket"]]);
  });

  it("불규칙 동사를 원형과 맞춘다", () => {
    assert.deepEqual(found("He broke the ice with a joke."), [["break the ice", "broke the ice"]]);
    assert.deepEqual(found("The ice was broken"), [["ice", "ice"]]);
  });

  it("겹치면 긴 숙어를 우선하고 안의 짧은 표현은 따로 잡지 않는다", () => {
    assert.deepEqual(found("Breaking the ice is hard."), [["break the ice", "Breaking the ice"]]);
    // 숙어 밖에 따로 나온 ice는 잡는다
    assert.deepEqual(found("We broke the ice. Then the ice melted."), [
      ["break the ice", "broke the ice"],
      ["ice", "ice"],
    ]);
  });

  it("spilled와 spilt를 같은 단어로 본다", () => {
    assert.deepEqual(found("She spilled the beans."), [["spill the beans", "spilled the beans"]]);
    assert.deepEqual(found("She spilt the beans."), [["spill the beans", "spilt the beans"]]);
    assert.deepEqual(found("Don't cry over spilt milk."), [["cry over spilled milk", "cry over spilt milk"]]);
  });

  it("one's·someone's 자리 표시를 소유격과 맞춘다", () => {
    assert.deepEqual(found("He lost his temper again."), [["lose one's temper", "lost his temper"]]);
    assert.deepEqual(found("They are losing their temper"), [["lose one's temper", "losing their temper"]]);
    assert.deepEqual(found("Stop pulling John's leg!"), [["pull someone's leg", "pulling John's leg"]]);
    assert.deepEqual(found("She stole my thunder."), [["steal someone's thunder", "stole my thunder"]]);
    assert.deepEqual(found("Hold your horses."), [["hold one's horses", "Hold your horses"]]);
    // 소유격이 아닌 단어는 자리 표시와 맞지 않는다
    assert.deepEqual(found("He lost the temper"), []);
  });

  it("대소문자와 굽은 따옴표를 구분하지 않는다", () => {
    assert.deepEqual(found("KICK THE BUCKET"), [["kick the bucket", "KICK THE BUCKET"]]);
    assert.deepEqual(found("He lost his temper and pulled Jane’s leg"), [
      ["lose one's temper", "lost his temper"],
      ["pull someone's leg", "pulled Jane’s leg"],
    ]);
  });

  it("문장부호 옆의 단어도 찾고, 위치는 원문 기준이다", () => {
    const text = '"Soapbox," she said. It was a piece of cake!';
    const matches = findPhrases(text, index);
    assert.deepEqual(
      matches.map((m) => [m.word, text.slice(m.start, m.end)]),
      [
        ["soapbox", "Soapbox"],
        ["piece of cake", "piece of cake"],
      ]
    );
  });

  it("쉼표나 마침표를 건너 숙어를 맞추지 않는다", () => {
    assert.deepEqual(found("Kick the bucket"), [["kick the bucket", "Kick the bucket"]]);
    assert.deepEqual(found("Kick, the bucket"), []);
    assert.deepEqual(found("I kick. The bucket is red."), []);
  });

  it("하이픈과 공백을 같은 구분으로 본다", () => {
    assert.deepEqual(found("It was a wild-goose chase."), [["wild-goose chase", "wild-goose chase"]]);
    assert.deepEqual(found("It was a wild goose chase."), [["wild-goose chase", "wild goose chase"]]);
  });

  it("줄바꿈으로 나뉜 숙어도 찾는다", () => {
    assert.deepEqual(found("They can barely make\nends meet."), [["make ends meet", "make\nends meet"]]);
  });

  it("등록되지 않은 표현은 찾지 않는다", () => {
    assert.deepEqual(found("The weather is lovely today."), []);
    assert.deepEqual(found(""), []);
  });
});

describe("lemmaCandidates", () => {
  it("규칙 활용형의 원형 후보를 만든다", () => {
    for (const [form, base] of [
      ["kicked", "kick"],
      ["baked", "bake"],
      ["stopped", "stop"],
      ["tried", "try"],
      ["running", "run"],
      ["making", "make"],
      ["lying", "lie"],
      ["watches", "watch"],
      ["spies", "spy"],
      ["beans", "bean"],
    ]) {
      assert.ok(lemmaCandidates(form).has(base), `${form} → ${base}`);
    }
  });

  it("-ss로 끝나는 단어는 s를 떼지 않는다", () => {
    assert.ok(!lemmaCandidates("miss").has("mis"));
  });
});

describe("extractSentence", () => {
  const text = "First sentence here. He kicked the bucket last year! Third one?";

  it("표현이 든 문장만 잘라내고 위치를 문장 기준으로 바꾼다", () => {
    const start = text.indexOf("kicked");
    const end = start + "kicked the bucket".length;
    const result = extractSentence(text, start, end);
    assert.equal(result.sentence, "He kicked the bucket last year!");
    assert.equal(result.sentence.slice(result.start, result.end), "kicked the bucket");
  });

  it("줄바꿈도 문장 경계로 본다", () => {
    const multi = "Line one\nbreak the ice here\nline three";
    const start = multi.indexOf("break");
    const result = extractSentence(multi, start, start + "break the ice".length);
    assert.equal(result.sentence, "break the ice here");
  });

  it("긴 문장은 표현을 가운데 두고 줄인다", () => {
    const long = `${"word ".repeat(80)}kicked the bucket ${"word ".repeat(80)}`;
    const start = long.indexOf("kicked");
    const end = start + "kicked the bucket".length;
    const result = extractSentence(long, start, end, 60);
    assert.ok(result.sentence.startsWith("…") && result.sentence.endsWith("…"));
    assert.ok(result.sentence.length <= 62);
    assert.equal(result.sentence.slice(result.start, result.end), "kicked the bucket");
  });
});
