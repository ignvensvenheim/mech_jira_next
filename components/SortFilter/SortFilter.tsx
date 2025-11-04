"use client";

import "./sortFilter.css";
import ExportIssuesButton from "../ExportIssuesButton/ExportIssuesButton";

const STATUS_OPTIONS = [
  "To Do List",
  "In Progress",
  "Pending",
  "Done",
  "Cancelled",
];

type Props = {
  sort: "newest" | "oldest";
  onSortChange: (sort: "newest" | "oldest") => void;
  dateFrom: string;
  dateTo: string;
  onDateChange: (from: string, to: string) => void;
  onReset: () => void;
  selectedStatuses: string[];
  onStatusChange: (statuses: string[]) => void;
  selectedDepartment: string;
  onDepartmentChange: (dep: string) => void;
  selectedLine: string;
  onLineChange: (line: string) => void;
};

const DEPARTMENT_LINES: Record<string, string[]> = {
  AB: [
    "UV linijos",
    "UV apdailos linija",
    "UV dažymo kameros ir pompos",
    "CEFLA linijos",
    "CEFLA dažymo linija",
  ],
  LPB: [
    "Josting - I giljotina",
    "Josting - II giljotina",
    "Josting - III giljotina",
    "Ompec - I giljotina",
    "Ompec - II giljotina",
    "Kuper - I",
    "Kuper - II",
    "Josting atliekų kapoklė",
    "Kuper lukšto klijavimo",
  ],
  SB: [
    "SIGNODE (nauja)",
    "SIGNODE (sena)",
    "ECOMAT apvyniojimo ireng.",
    "Surinkimo linija",
  ],
  PB: [],
  MB1: [
    "IMA line",
    "HOLZMA nauja",
    "HOLZMA sena",
    "Homag FLEXLINE",
    "Homag POWER LINE",
    "FRIZ presas",
    "ORMA presas",
    "ITALPRESS presas",
    "BURKLE presas",
    "HOLZMA laminatui",
    "Laminato formatavimo pjūklas",
    "Laminato giljotina",
  ],
  MB2: [
    "ALTENDORF pjūklas",
    "MAW kaiščiavimas",
    "BAUERLE frezeris",
    "ARMINIUS br. šlif. staklės",
    "TAGLIABUE kalibravimas",
    "BRANDT stalų briaunavimo",
    "BAZ 222-60 +keltuvas",
    "Weeke CNC_II",
    "Weeke CNC _I",
    "Weeke BHX500",
    "BAZ 32 +keltuvas",
    "Weeke BST500 kaiščiavimas",
    "Rover 24L +keltuvas",
    "Weeke BHX055",
    "Weeke BHT500",
    "Homag KAL370 vienpusis",
    "BAZ 222-40 +keltuvas",
    "Homag CENTATEQ P-210",
  ],
  MB3: [
    "Homag KAL310 briaunavimas",
    "Weeke BHP200 nestingas",
    "Dulkių nutraukimas",
    "Gannomat kaiščiavimas",
    "DRILLTEQ V200 gręžimas",
  ],
  SPEC: [],
  Elektrokrautuvai: [
    "Nr. 6 LINDE dyz.",
    "Nr. 2 BT elektrinis vežimėlis",
    "Nr. 11 BOSS elektr.",
    "Nr. 21 CARRELLFICIO keltuvas",
    "Nr. 10 TOYOTA elektr.",
    "Nr. 1 STILL elektr.",
    "Nr. 7 ROCLA keltuvas",
    "Nr. 22 MITSUBISHI elektr.",
    "Nr. 5 LANSING elektr.",
    "Nr. 16 BT-100M elektr.",
    "Nr. 8 BT-100M elektr.",
    "Nr. 9 LANSING elektr.",
    "Nr. 13 KALMAR elektr.",
    "Nr. 23 SKYJACK žirklinis",
    "Nr. 4 JUNGHEINRICH elektr.",
    "Nr. 24 JUNGHEINRICH duj.",
    "Nr. 25 JUNGHEINRICH elektr.",
    "Nr. 14 JUNGHEINRICH elektr.",
  ],
  KITA: [
    "Įrankių galandinimas",
    "Suspausto oro vamzdynai",
    "Pirkimo užsakymai gamybai",
    "Ištraukimo sistemos",
    "Kompresoriai",
    "Drėkinimo sistema UNIFOG",
    "Hidrauliniai vežimėliai / keltuvai",
    "Matavimo priemonės",
    "Rankiniai įrankiai",
    "Apšvietimo ir jėgos el. tinklai",
    "Pastatų priežiūra, ūkio darbai",
    "Signalizacijos ir komp. tinklai",
  ],
  // Add your departments and lines here
};

export function SortFilter({
  sort,
  onSortChange,
  dateFrom,
  dateTo,
  onDateChange,
  onReset,
  selectedStatuses,
  onStatusChange,
  selectedDepartment,
  onDepartmentChange,
  selectedLine,
  onLineChange,
}: Props) {
  const toggleStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      onStatusChange(selectedStatuses.filter((s) => s !== status));
    } else {
      onStatusChange([...selectedStatuses, status]);
    }
  };

  return (
    <div className="sort-filter">
      <div className="sort-filter__controls">
        <div className="sort-filter__new-old">
          <label>Show:</label>
          <select
            className="sort-filter__pill"
            value={sort}
            onChange={(e) =>
              onSortChange(e.target.value as "newest" | "oldest")
            }
          >
            <option value="newest">Newest first</option>
            <option value="oldest">Oldest first</option>
          </select>
        </div>

        <div className="sort-filter__date">
          <label>From:</label>
          <input
            className="sort-filter__pill"
            type="date"
            value={dateFrom}
            onChange={(e) => onDateChange(e.target.value, dateTo)}
          />
          <label>To:</label>
          <input
            className="sort-filter__pill"
            type="date"
            value={dateTo}
            onChange={(e) => onDateChange(dateFrom, e.target.value)}
          />
        </div>

        <div className="sort-filter__status-pills">
          <label>Status:</label>
          {STATUS_OPTIONS.map((status) => (
            <button
              key={status}
              type="button"
              className={`sort-filter__pill ${
                selectedStatuses.includes(status)
                  ? "sort-filter__pill--active"
                  : ""
              }`}
              onClick={() => toggleStatus(status)}
            >
              {status}
            </button>
          ))}
        </div>

        <div className="sort-filter__department-line">
          <label>Department:</label>
          <select
            value={selectedDepartment}
            onChange={(e) => onDepartmentChange(e.target.value)}
          >
            <option value="">All</option>
            {Object.keys(DEPARTMENT_LINES).map((dep) => (
              <option key={dep} value={dep}>
                {dep}
              </option>
            ))}
          </select>

          <label>Line:</label>
          <select
            value={selectedLine}
            onChange={(e) => onLineChange(e.target.value)}
            disabled={!selectedDepartment}
          >
            <option value="">All</option>
            {(DEPARTMENT_LINES[selectedDepartment] || []).map((line) => (
              <option key={line} value={line}>
                {line}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="sort-filter__actions">
        <button className="sort-filter__reset" onClick={onReset}>
          Reset filters
        </button>
        <ExportIssuesButton issues={[]} />{" "}
        {/* You can pass filtered issues if needed */}
      </div>
    </div>
  );
}
