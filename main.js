const iconv = require("iconv-lite");
const fs = require("fs");
const csv = require("csvtojson");
const { JSDOM } = require("jsdom");
const request = require("request-promise");
const moment = require("moment");

patientsSite =
  "https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_patients";
screendSite =
  "https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_test_count";
hotlineSite =
  "https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_call_center";
negatibSite =
  "https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_confirm_negative";
//kikokusyasessyokusyaSite =
//  "https://ckan.open-governmentdata.org/dataset/401307_covid19_kikokusyasessyokusya";
//totalparsonsSite =
//  "https://ckan.open-governmentdata.org/dataset/401307_covid19_totalpatients";

const data1 = "patients.json";
const data2 = "test_count.json";
const data3 = "call_center.json";
const data4 = "confirm_negative.json";
const data5 = "data500.json";
const resultPath = "data.json";
const inspectResultPath = "inspections_summary.json";

const dateFrom = new moment("2020-01-24");

const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

const escDate = (dateStr) => {
  return dateStr.replace(/\//g, "\\/");
};

/*
{
  updateDate:"",
  csvData:"",//json
}
*/
const getCsv = async function (url, filePath) {
  result = {};
  const dlSite = await request(url);
  //const dlSite = iconv.decode(dlRaw,"Shift_JIS")
  //console.log(dlSite);
  var dom = new JSDOM(dlSite);
  const table = dom.window.document.querySelector("table");
  {
    table
      .querySelector("tbody")
      .querySelectorAll("tr")
      .forEach((elm) => {
        const head = elm.querySelector("th").innerHTML;
        let val = "";
        if (head == "最終更新" || head == "作成日") {
          var a = elm
            .querySelector("td")
            .firstChild.nextSibling.getAttribute("data-datetime");
          val = a;
        } else {
          var a = elm.querySelector("td");
          val = a.innerHTML;
        }
        result[head] = val;
      });
  }

  const csvUrl = dom.window.document.querySelector(".resource-url-analytics")
    .href;
  const csvRow = await request({ uri: csvUrl, encoding: null });
  const csvBody = iconv.decode(csvRow, "Shift_JIS");
  const dataBody = await csv().fromString(csvBody);
  result["body"] = dataBody;
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
};

const genContacts = function (srcPath) {
  return {
    contacts: {
      date: "2020/04/17 10:00",
      data: [
        {
          日付: "2020-02-07T00:00:00Z",
          曜日: "金",
          "9-13時": 0,
          "13-17時": 0,
          "17-21時": 26,
          date: "2020-02-07",
          w: 5,
          short_date: "02/07",
          小計: 26,
        },
      ],
    },
  };
};
const genQuerents = function (srcPath) {
  return {
    querents: {
      date: "2020/04/17 10:00",
      data: [
        {
          日付: "2020-01-27T00:00:00Z",
          曜日: "月",
          "9-17時": 39,
          "17-翌9時": 0,
          date: "2020-01-27",
          w: 1,
          short_date: "01/27",
          小計: 39,
        },
      ],
    },
  };
};
const genPatients = function (srcPath) {
  let data = fs.readFileSync(srcPath);
  let obj = JSON.parse(data);
  let updateDate = moment(obj["最終更新"]);
  let table = obj.body;
  let datas = [];
  for (let r of table) {
    let date = moment(r["公表_年月日"]);
    let d = {
      リリース日: date.toISOString(), //"2020-04-15T00:04:00.000Z",
      居住地: r["市区町村名"],
      年代: r["患者_年代"],
      性別: r["患者_性別"],
      退院: r["患者_退院済フラグ"] == "1" ? "○" : "",
      date: date.format("YYYY-MM-DD"), //"2020-04-15",
    };
    datas.push(d);
  }
  return {
    patients: {
      date: updateDate.format("YYYY/MM/DD HH:mm"), //"2020/04/17 21:00",
      data: datas,
    },
  };
};
const genPatientsSummary = function (srcPath) {
  let data = fs.readFileSync(srcPath);
  let obj = JSON.parse(data);
  let updateDate = moment(obj["最終更新"]);
  let table = obj.body;

  let sum = {};
  for (let r of table) {
    let date = moment(r["公表_年月日"]).format("YYYY-MM-DD");
    if (!sum[date]) {
      sum[date] = 0;
    }
    sum[date]++;
  }

  let datas = [];
  for (
    var target = dateFrom.clone();
    target.isBefore(moment.now());
    target.add(1, "days")
  ) {
    datas.push({
      日付: target.toISOString(),
      小計: sum[target.format("YYYY-MM-DD")] || 0,
    });
  }

  return {
    patients_summary: {
      date: updateDate.format("YYYY/MM/DD HH:mm"), //"2020/04/17 21:00",
      data: datas,
    },
  };
};
const genDischargesSummary = function (srcPath) {
  return {
    discharges_summary: {
      date: "2020/04/17 21:00",
      data: [
        {
          日付: "2020-01-24T08:00:00.000Z",
          小計: 0,
        },
      ],
    },
  };
};
const genInspectionsSummary = function (srcPath) {
  let data = fs.readFileSync(srcPath);
  let obj = JSON.parse(data);
  let updateDate = moment(obj["最終更新"]);
  let table = obj.body;
  let dailylist = {};
  for (let r of table) {
    let p = parseInt(r["検査実施_件数"]);
    if (isNaN(p)) {
      p = 0;
    }
    dailylist[r["実施_年月日"]] = p;
  }

  datas = [];
  labels = [];
  for (
    var target = dateFrom.clone();
    target.isBefore(moment.now());
    target.add(1, "days")
  ) {
    let key = target.format("YYYY-MM-DD");
    let val = dailylist[key] || 0;
    labels.push(target.format("M/D"));
    datas.push(val);
  }

  return {
    inspections_summary: {
      date: updateDate.format("YYYY/MM/DD HH:mm"), //"2020/04/17 11:00",
      data: {
        市内: datas,
      },
      labels: labels,
    },
  };
};
const genInspectionPersons = function (srcPath) {
  let file = fs.readFileSync(srcPath);
  let obj = JSON.parse(file);
  let table = obj.body[0];

  return {
    inspections_persons: {
      date: "2020/04/17 11:00",
      data: {
        市内: [0],
      },
      labels: ["1/24"],
    },
  };
};
const genMainSummary = function (patientSrcPath, InspectioSrcPath) {
  let insCnt = 0;
  let lastUpdate;
  {
    let data = fs.readFileSync(InspectioSrcPath);
    let obj = JSON.parse(data);
    lastUpdate = moment(obj["最終更新"]);
    let table = obj.body;
    for (r of table) {
      insCnt += parseInt(r["検査実施_件数"]);
    }
  }
  let data = fs.readFileSync(patientSrcPath);
  let obj = JSON.parse(data);
  let table = obj.body;

  let posall = table.length;
  let nyuuinn = 0;
  let keisyou = 0;
  let juusyou = 0;
  let taiinn = 0;
  let sibou = 0;
  for (const p of table) {
    switch (p["患者_状態"]) {
      case "入院中":
      case "自宅待機中":
      case "入院先調整中":
        nyuuinn++;
        break;
      case "退院":
        taiinn++;
        break;
      case "死亡":
        sibou++;
        break;
    }
    switch (p["患者_症状"]) {
    }
  }

  return {
    lastUpdate: lastUpdate,
    main_summary: {
      attr: "検査実施人数",
      value: insCnt,
      children: [
        {
          attr: "陽性患者数",
          value: posall,
          children: [
            {
              attr: "入院中",
              value: nyuuinn,
              children: [
                {
                  attr: "軽症・中等症",
                  value: 0,
                },
                {
                  attr: "重症",
                  value: 0,
                },
              ],
            },
            {
              attr: "退院",
              value: taiinn,
            },
            {
              attr: "死亡",
              value: sibou,
            },
          ],
        },
      ],
    },
  };
};

const genInspectorSummary2 = function (InspectioSrcPath, NegativeSrcPath) {
  let insList = {};
  let negList = {};
  let insUpdate;
  let negUpdate;
  {
    let data = fs.readFileSync(InspectioSrcPath);
    let obj = JSON.parse(data);
    insUpdate = moment(obj["最終更新"]);
    let table = obj.body;
    for (let r of table) {
      let p = parseInt(r["検査実施_件数"]);
      if (isNaN(p)) {
        p = 0;
      }
      insList[r["実施_年月日"]] = p;
    }
  }
  {
    let data = fs.readFileSync(NegativeSrcPath);
    let obj = JSON.parse(data);
    negUpdate = moment(obj["最終更新"]);
    let table = obj.body;
    for (let r of table) {
      let p = parseInt(r["陰性確認_件数"]);
      if (isNaN(p)) {
        p = 0;
      }
      negList[r["完了_年月日"]] = p;
    }
  }

  let il = [];
  let pl = [];
  let labels = [];
  let dn = negUpdate > insUpdate ? negUpdate : insUpdate;
  for (
    var target = dateFrom.clone();
    target.isBefore(moment.now());
    target.add(1, "days")
  ) {
    let key = target.format("YYYY-MM-DD");
    try {
      let ii = insList[key] || 0;
      let ng = negList[key] || 0;

      ii=parseInt(ii);
      ng=parseInt(ng);

      il.push(ii);
      pl.push(ii - ng);
      labels.push(target.format("M/D"));
    } catch (e) {
      console.log(`failed:${key}`);
    }
  }

  return {
    data: {
      検査検体数: il,
      陽性確認: pl,
    },
    labels: labels,
    last_update: dn.format("YYYY/MM/DD HH:mm"), //"2020/04/17 21:00",
  };
};

const main = async function () {
  await getCsv(patientsSite,data1);
  await getCsv(screendSite,data2);
  await getCsv(hotlineSite,data3);
  await getCsv(negatibSite,data4);

  //await getCsv(kikokusyasessyokusyaSite,data4);
  //await getCsv(totalparsonsSite,data5);

  const res = {
    ...genContacts(data3),
    ...genQuerents(data4),
    ...genPatients(data1),
    ...genPatientsSummary(data1),
    ...genDischargesSummary(data2),
    ...genInspectionsSummary(data2),
    ...genInspectionPersons(data2),
    ...genMainSummary(data1, data2),
  };

  const res2 = genInspectorSummary2(data2, data4);

  fs.writeFileSync(
    resultPath,
    JSON.stringify(res, null, 1).replace(/\//g, "\\/")
  );

  fs.writeFileSync(
    inspectResultPath,
     JSON.stringify(res2, null, 1).replace(/\//g, "\\/")
     );
};

main();
