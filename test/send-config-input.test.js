const cloneDeep = require("lodash.clonedeep");
const expect = require("expect");
const helper = require("node-red-node-test-helper");
const powerSaver = require("../power-saver.js");
const { DateTime } = require("luxon");
const prices = require("./data/prices");
const result = require("./data/result");
const reconfigResult = require("./data/reconfigResult");
const { testPlan, makeFlow, makePayload } = require("./test-utils");

helper.init(require.resolve("node-red"));

describe("send config as input", () => {
  beforeEach(function (done) {
    helper.startServer(done);
  });

  afterEach(function (done) {
    helper.unload().then(function () {
      helper.stopServer(done);
    });
  });

  it("should send new schedule on output 3", function (done) {
    const flow = makeFlow(3, 2);
    let pass = 1;
    helper.load(powerSaver, flow, function () {
      const n1 = helper.getNode("n1");
      const n2 = helper.getNode("n2");
      n2.on("input", function (msg) {
        console.log("Pass " + pass);
        console.log(JSON.stringify(msg, null, 2));
        switch (pass) {
          case 1:
            pass++;
            expect(msg).toHaveProperty("payload", result);
            n1.receive({ payload: { config: { minSaving: 1.0 } } });
            break;
          case 2:
            pass++;
            expect(msg.payload.schedule.length).toEqual(1);
            n1.receive({ payload: makePayload(prices, testPlan.time) });
            break;
          case 3:
            pass++;
            expect(msg.payload.schedule.length).toEqual(1);
            done();
        }
      });
      n1.receive({ payload: makePayload(prices, testPlan.time) });
    });
  });
  it("should schedule only from selected time", function (done) {
    const flow = makeFlow(3, 2);
    flow[0].scheduleOnlyFromCurrentTime = false;
    const changeTime = DateTime.fromISO("2021-06-20T01:50:00.045+02:00");
    let pass = 1;
    helper.load(powerSaver, flow, function () {
      const n1 = helper.getNode("n1");
      const n2 = helper.getNode("n2");
      n2.on("input", function (msg) {
        console.log("Pass " + pass);
        console.log(JSON.stringify(msg, null, 2));
        switch (pass) {
          case 1:
            pass++;
            // expect(msg).toHaveProperty("payload", result);
            expect(equalPlan(result, msg.payload)).toBeTruthy();
            n1.receive({
              payload: {
                config: { scheduleOnlyFromCurrentTime: true },
                time: changeTime,
              },
            });
            break;
          case 2:
            pass++;
            reconfigResult.config.scheduleOnlyFromCurrentTime = true;
            // expect(msg).toHaveProperty("payload", reconfigResult);
            expect(equalPlan(reconfigResult, msg.payload)).toBeTruthy();
            const payload = makePayload(prices, testPlan.time);
            payload.time = changeTime;
            n1.receive({ payload });
            break;
          case 3:
            pass++;
            // expect(msg).toHaveProperty("payload", reconfigResult);
            expect(equalPlan(reconfigResult, msg.payload)).toBeTruthy();
            done();
        }
      });
      n1.receive({ payload: makePayload(prices, testPlan.time) });
    });
  });
});

function equalPlan(expected, actual) {
  let res = true;
  if (expected.schedule.length !== actual.schedule.length) {
    console.log(
      "Schedules have different lengths: Expected " + expected.schedule.length + ", got " + actual.schedule.length
    );
    res = false;
  }
  if (expected.hours.length !== actual.hours.length) {
    console.log("Hours have different lengths: Expected " + expected.hours.length + ", got " + actual.hours.length);
  }
  expected.schedule.forEach((s, i) => {
    ["time", "value"].forEach((key) => {
      if (s[key] != actual.schedule[i][key]) {
        console.log(
          "Different schedule values for " +
            key +
            " at index " +
            i +
            ": Expected " +
            s[key] +
            ", got " +
            actual.schedule[i][key]
        );
        res = false;
      }
    });
  });
  expected.hours.forEach((s, i) => {
    ["price", "onOff", "start", "saving"].forEach((key) => {
      if (s[key] != actual.hours[i][key]) {
        console.log(
          "Different hour values for " +
            key +
            " at index " +
            i +
            ": Expected " +
            s[key] +
            ", got " +
            actual.hours[i][key]
        );
        res = false;
      }
    });
  });

  [
    "maxHoursToSaveInSequence",
    "minHoursOnAfterMaxSequenceSaved",
    "minSaving",
    "outputIfNoSchedule",
    "scheduleOnlyFromCurrentTime",
  ].forEach((key) => {
    if (expected.config[key] != actual.config[key]) {
      console.log(
        "Different config values for " + key + ": Expected " + expected.config[key] + ", got " + actual.config[key]
      );
      res = false;
    }
  });

  return res;
}
