const iconv = require('iconv-lite');
const fs = require('fs');
const csv = require('csvtojson');
const { JSDOM } = require('jsdom');
const request = require('request-promise');
//const moment = require("moment");
//require('moment-timezone');
const moment = require('moment-timezone');
moment.tz.setDefault('Asia/Tokyo');
const Parser = require('rss-parser');

patientsSite =
  'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_patients';
screendSite =
  'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_test_count';
hotlineSite =
  'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_call_center';
negatibSite =
  'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_confirm_negative';
inspectBreakdownSite =
  'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_test_count_breakdown';
privateInspectBreakdownSite =
  'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_test_count_privateinspection';
symptomSite =
  'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_patients_symptom';
//kikokusyasessyokusyaSite =
//  "https://ckan.open-governmentdata.org/dataset/401307_covid19_kikokusyasessyokusya";
//totalparsonsSite =
//  "https://ckan.open-governmentdata.org/dataset/401307_covid19_totalpatients";
injectionSite = 'https://ckan.open-governmentdata.org/dataset/401005_kitakyushu_covid19_injection';
newsRss = 'https://www.city.kitakyushu.lg.jp/soumu/covid-19.rdf';

const data1 = 'patients.json';
const data2 = 'test_count.json';
const data3 = 'call_center.json';
const data4 = 'confirm_negative.json';
const data5 = 'test_count_breakdown.json';
const data6 = 'private_test_count_breakdown.json';
const data7 = 'simptom.json';
const data8 = 'injection.json';

//const data5 = "data500.json";
const resultPath = 'data.json';
const inspectResultPath = 'inspections_summary.json';
const inspectBreakdownPath = 'inspections_breakdown.json';
//const newsResultPath = "news.json";

const dateFrom = new moment('2020-01-24');

const sleep = (msec) => new Promise((resolve) => setTimeout(resolve, msec));

const escDate = (dateStr) => {
  return dateStr.replace(/\//g, '\\/');
};

/*
{
  updateDate:"",
  csvData:"",//json
}
*/
const getCsv = async function (url, filePath, charSet = 'Shift_JIS') {
  result = {};
  const dlSite = await request(url);
  //const dlSite = iconv.decode(dlRaw,"Shift_JIS")
  //console.log(dlSite);
  var dom = new JSDOM(dlSite);
  const table = dom.window.document.querySelector('table');
  {
    table
      .querySelector('tbody')
      .querySelectorAll('tr')
      .forEach((elm) => {
        const head = elm.querySelector('th').innerHTML;
        let val = '';
        if (head == '最終更新' || head == '作成日') {
          var a = elm
            .querySelector('td')
            .firstChild.nextSibling.getAttribute('data-datetime');
          val = a;
        } else {
          var a = elm.querySelector('td');
          val = a.innerHTML;
        }
        result[head] = val;
      });
  }

  const csvUrl = dom.window.document.querySelector('.resource-url-analytics')
    .href;
  const csvRow = await request({ uri: csvUrl, encoding: null });
  const csvBody = iconv.decode(csvRow, charSet);
  const dataBody = await csv().fromString(csvBody);
  result['body'] = dataBody;
  fs.writeFileSync(filePath, JSON.stringify(result, null, 2));
};

const genContacts = function (srcPath) {
  let data = fs.readFileSync(srcPath);
  let obj = JSON.parse(data);
  let updateDate = moment(); //moment(obj["最終更新"]);
  let latestDate;
  let table = obj.body;
  let dailylist = {};
  for (let r of table) {
    let p = parseInt(r['相談件数']);
    key = moment(r['受付_年月日'], 'YYYY/M/D').format('YYYY/MM/DD');
    if (isNaN(p)) {
      p = 0;
      break;
    }
    dailylist[key] = p;
    latestDate = key;
  }
  datas = [];
  for (
    var target = dateFrom.clone();
    target.isBefore(moment(latestDate, 'YYYY/MM/DD').add(1, 'days'));
    target.add(1, 'days')
  ) {
    let key = target.format('YYYY/MM/DD');
    let val = dailylist[key] || 0;
    datas.push({
      日付: moment(key, 'YYYY/MM/DD').tz('Asia/Tokyo').add(9, 'h').format(),
      小計: val,
    });
  }
  return {
    contacts: {
      date: updateDate.format('YYYY/MM/DD HH:mm'), //"2020/04/17 10:00",
      data: datas,
    },
  };
};
const genQuerents = function (srcPath) {
  return {
    querents: {
      date: '2020/04/17 10:00',
      data: [
        {
          日付: '2020-01-27T00:00:00Z',
          曜日: '月',
          '9-17時': 39,
          '17-翌9時': 0,
          date: '2020-01-27',
          w: 1,
          short_date: '01/27',
          小計: 39,
        },
      ],
    },
  };
};
const genPatients = function (srcPath) {
  let data = fs.readFileSync(srcPath);
  let obj = JSON.parse(data);
  let updateDate = moment(); //moment(obj["最終更新"]);
  let table = obj.body;
  let datas = [];
  let pre_date = moment();
  for (let r of table) {
    let date = moment(r['公表_年月日'], 'YYYY/M/D');
    if (date.toISOString() === null) {
      date = pre_date; // dateが異常な時、前行のdateを使う
    } else {
      pre_date = date;
    }
    let d = {
      リリース日: date.toISOString(), //"2020-04-15T00:04:00.000Z",
      居住地: r['患者_居住地'].replace('福岡県北九州市', ''),
      年代: r['患者_年代'],
      性別: r['患者_性別'],
      //  退院: r['患者_退院済フラグ'] == '1' ? '○' : '',  // 退院フラグが無くなっているので無駄データを作らない
      date: date.format('YYYY-MM-DD'), //"2020-04-15",
    };
    datas.push(d);
  }
  return {
    patients: {
      date: updateDate.format('YYYY/MM/DD HH:mm'), //"2020/04/17 21:00",
      data: datas,
    },
  };
};
const genPatientsSummary = function (srcPath) {
  let data = fs.readFileSync(srcPath);
  let obj = JSON.parse(data);
  let table = obj.body;
  let pre_date = moment();
  let sum = {};
  for (let r of table) {
    //    let date = moment(r['公表_年月日'], 'YYYY/M/D').format('YYYY-MM-DD');
    let date = moment(r['公表_年月日'], 'YYYY/M/D');
    if (date.toISOString() === null) {
      date = pre_date; // dateが異常な時、前行のdateを使う
    } else {
      pre_date = date;
    }
    date = date.format('YYYY-MM-DD');
    if (!sum[date]) {
      sum[date] = 0;
    }
    sum[date]++;
  }

  let datas = [];
  for (
    var target = dateFrom.clone();
    target.isBefore(moment().subtract(1, 'd'));
    target.add(1, 'days')
  ) {
    datas.push({
      日付: target.toISOString(),
      小計: sum[target.format('YYYY-MM-DD')] || 0,
    });
  }

  return {
    patients_summary: {
      date: moment().format('YYYY/MM/DD HH:mm'), //"2020/04/17 21:00",
      data: datas,
    },
  };
};
const genDischargesSummary = function (srcPath) {
  return {
    discharges_summary: {
      date: '2020/04/17 21:00',
      data: [
        {
          日付: '2020-01-24T08:00:00.000Z',
          小計: 0,
        },
      ],
    },
  };
};
const genInspectionsSummary = function (srcPath) {
  let data = fs.readFileSync(srcPath);
  let obj = JSON.parse(data);
  let table = obj.body;
  let dailylist = {};
  for (let r of table) {
    let p = parseInt(r['検査実施_件数']);
    key = moment(r['実施_年月日'], 'YYYY/M/D').format('YYYY/MM/DD');
    if (isNaN(p)) {
      p = 0;
    }
    dailylist[key] = p;
  }

  datas = [];
  labels = [];
  for (
    var target = dateFrom.clone();
    target.isBefore(moment.now());
    target.add(1, 'days')
  ) {
    let key = target.format('YYYY/MM/DD');
    let val = dailylist[key] || 0;
    labels.push(target.format('M/D'));
    datas.push(val);
  }

  return {
    inspections_summary: {
      date: moment().format('YYYY/MM/DD HH:mm'), //"2020/04/17 11:00",
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
      date: '2020/04/17 11:00',
      data: {
        市内: [0],
      },
      labels: ['1/24'],
    },
  };
};
const genMainSummary = function (symptomPath) {
  let insCnt = 0;
  let data = fs.readFileSync(symptomPath);
  let obj = JSON.parse(data);
  let table = obj.body;
  for (r of table) {
    insCnt += 1;
  }

  let posall = r['陽性者数_累計'];
  let nyuuinn = r['入院等'];
  let mushojo = r['入院等・調整中内訳_無症状'];
  let keisyou = r['入院等・調整中内訳_軽症・中等症'];
  let juusyou = r['入院等・調整中内訳_重症'];
  let confirming = r['入院等・調整中内訳_確認中'];
  let taiinn = r['退院'];
  let sibou = r['死亡'];
  let tbs = r['調整中'];

  return {
    lastUpdate: moment().format('YYYY/MM/DD HH:mm'), //"2020/04/17 11:00",
    main_summary: {
      attr: 'データ行数',
      value: insCnt,
      children: [
        {
          attr: '陽性患者数',
          value: parseInt(posall),
          children: [
            {
              attr: '入院中',
              value: parseInt(nyuuinn),
              children: [
                {
                  attr: '無症状',
                  value: parseInt(mushojo),
                },
                {
                  attr: '軽症・中等症',
                  value: parseInt(keisyou),
                },
                {
                  attr: '重症',
                  value: parseInt(juusyou),
                },
                {
                  attr: '確認中',
                  value: parseInt(confirming),
                },
              ],
            },
            {
              attr: '調整中',
              value: parseInt(tbs),
            },
            {
              attr: '死亡',
              value: parseInt(sibou),
            },
            {
              attr: '退院',
              value: parseInt(taiinn),
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
  let insKey;
  let negKey;
  {
    let data = fs.readFileSync(InspectioSrcPath);
    let obj = JSON.parse(data);
    insUpdate = moment(obj['最終更新']);
    let table = obj.body;
    for (let r of table) {
      let p = parseInt(r['検査実施_件数']);
      key = moment(r['実施_年月日'], 'YYYY/M/D').format('YYYY/MM/DD');
      if (isNaN(p)) {
        p = 0;
      }
      insList[key] = p;
      insKey = key;
    }
  }
  {
    let data = fs.readFileSync(NegativeSrcPath);
    let obj = JSON.parse(data);
    negUpdate = moment(obj['最終更新']);
    let table = obj.body;
    for (let r of table) {
      let p = parseInt(r['陰性確認_件数']);
      key = moment(r['完了_年月日'], 'YYYY/M/D').format('YYYY/MM/DD');
      if (isNaN(p)) {
        p = 0;
      }
      negList[key] = p;
      negKey = key;
    }
  }

  let il = [];
  let pl = [];
  let labels = [];
  let dn = moment(); //negUpdate > insUpdate ? negUpdate : insUpdate;
  let newestKey = negKey > insKey ? negKey : insKey;
  for (
    var target = dateFrom.clone();
    target.isBefore(moment(newestKey, 'YYYY/MM/DD').add(1, 'days'));
    target.add(1, 'days')
  ) {
    let key = target.format('YYYY/MM/DD');
    try {
      let ii = insList[key] || 0;
      let ng = negList[key] || 0;

      ii = parseInt(ii);
      ng = parseInt(ng);

      il.push(ii);
      pl.push(ii - ng);
      labels.push(target.format('YYYY/M/D'));
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
    last_update: dn.format('YYYY/MM/DD HH:mm'), //"2020/04/17 21:00",
  };
};

const getInspectionBreakdown = function (
  InspectionBreakdownPath,
  PrivateInspectionBreakdownPath
) {
  let labels = [];
  let attachman = [];
  let pcrcenter = [];
  let privateTest = [];
  let updateDate = moment(); //moment(obj["最終更新"]);
  let data = fs.readFileSync(InspectionBreakdownPath);
  let obj = JSON.parse(data);
  let priData = fs.readFileSync(PrivateInspectionBreakdownPath);
  let priObj = JSON.parse(priData);
  let ptable = priObj.body;
  //データが分かれているが、日付は1月30日からなので、配列の添え字でデータで突き合わせる
  //データ一本化されたら修正
  let ofs = 0;
  negUpdate = moment(obj['最終更新']);
  let table = obj.body;
  for (let r of table) {
    let p = parseInt(r['検査内訳_帰国者・接触者外来等']);
    let q = parseInt(r['検査内訳_ＰＣＲ検査センター']);
    let pr = parseInt(ptable[ofs++]['民間検査機関検査実施_件数']);
    key = moment(r['実施_年月日'], 'YYYY/M/D').format('YYYY/M/D');
    if (isNaN(p)) {
      p = 0;
    }
    attachman.push(p);
    pcrcenter.push(q);
    privateTest.push(pr);
    labels.push(key);
  }

  return {
    last_update: updateDate.format('YYYY/MM/DD HH:mm'), //"2020/04/17 21:00",
    data: {
      帰国者接触者外来等検査件数: attachman,
      ＰＣＲ検査センター検査件数: pcrcenter,
      民間検査機関検査件数: privateTest,
    },
    labels: labels,
  };
};

const getInjections = function (
  injectionPath,
) {
  let labels = [];
  let firsts = [];
  let seconds = [];
  let updateDate = moment(); 
  let data = fs.readFileSync(injectionPath);
  let obj = JSON.parse(data);

  let table = obj.body;
  for (let r of table) {
    let p = parseInt(r['1回目接種完了']);
    let q = parseInt(r['2回目接種完了']);
    key = moment(r['完了_年月日'], 'YYYY/M/D').format('YYYY/M/D');
    firsts.push(p);
    seconds.push(q);
    labels.push(key);
  }

  return {
    injection_persons: {
      date: updateDate.format('YYYY/MM/DD HH:mm'),
      data: {
        "1回目接種完了": firsts,
        "2回目接種完了": seconds,
      },
      labels: labels,
    },
  };
};

function waitTime(msec) {
  return new Promise(function (resolve) {
    setTimeout(function () {
      resolve();
    }, msec);
  });
}

//const main = async function () {
async function main() {
  await getCsv(patientsSite, data1);
  await getCsv(screendSite, data2);
  await getCsv(hotlineSite, data3);
  await getCsv(negatibSite, data4);
  await getCsv(inspectBreakdownSite, data5);
  await getCsv(privateInspectBreakdownSite, data6);
  await getCsv(symptomSite, data7);
  await getCsv(injectionSite, data8);

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
    ...genMainSummary(data7),
    ...getInjections(data8)
  };

  const res2 = genInspectorSummary2(data2, data4);
  const res3 = getInspectionBreakdown(data5, data6);

  fs.writeFileSync(
    resultPath,
    JSON.stringify(res, null, 1).replace(/\//g, '\\/')
  );

  fs.writeFileSync(
    inspectResultPath,
    JSON.stringify(res2, null, 1).replace(/\//g, '\\/')
  );

  fs.writeFileSync(
    inspectBreakdownPath,
    JSON.stringify(res3, null, 1).replace(/\//g, '\\/')
  );

  await waitTime(30000); // 30秒ウェイト Actionsのエラー解決に効果がなければ消す

  /*
  //get rss gen news.json
  let parser = new Parser();
  let news = [];
  let cnt = 0;
  const rss = await parser.parseURL(newsRss);
  rss.items.forEach((item) => {
    if (cnt++ < 5) {
      news.push({
        date: moment(item.isoDate).format("YYYY/MM/DD"),
        url: item.link,
        text: item.title,
      });
    }
  });

  fs.writeFileSync(
    newsResultPath,
    JSON.stringify({ newsItems: news }, null, 1).replace(/\//g, "\\/")
  );
*/
}

const t = async function () {
  await main();
};
t();
