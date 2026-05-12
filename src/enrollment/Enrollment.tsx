import "./Enrollment.scss";
import contrastColor from "font-color-contrast";
import SlantWrapper from "../component/SlantWrapper";
import { createSignal, Show } from "solid-js";
import { API_BASE } from "../util";

interface Course {
  color: string;
  sectionCode: string;
  term: string;
}

interface Schedule {
  scheduleNote: string;
  scheduleName: string;
  courses: Course[];
}

interface EnrollmentStatus {
  status: string;
  num_total_enrolled: number;
  num_on_waitlist: number;
  num_section_enrolled: number;
  max_capacity: number;
  quarter: string;
  year: string;
  section: { code: string; type: string };
  course: { title: string; id: string };
  color: string;
}

async function getEnrollmentData(courses: Course[]): Promise<EnrollmentStatus[]> {
  const sectionCodes = courses.map((c) => c.sectionCode).join(",");
  const [year, quarter] = courses[0].term.split(" ");

  const query = `query Course($query: WebsocQuery!) {
    websoc(query: $query) { schools { departments { courses {
      courseNumber, courseTitle, deptCode,
      sections {
        sectionCode, sectionType, status, numOnWaitlist, maxCapacity,
        numCurrentlyEnrolled { totalEnrolled }
      }
    }}}}
  }`;
  const variables = { query: { year, quarter, sectionCodes } };

  const headers = {
    // Publishable key generated from https://dashboard.anteaterapi.com/
    Authorization: "Bearer DDK7cO3ip5OIjvVCnR2fB4Nb635lnyMNpzV1LdSUgOU.pk.kytzgn98rwwvmgnm5j0yszqy",
    "Content-Type": "application/json",
  };
  const response = await fetch("https://anteaterapi.com/v2/graphql", {
    method: "POST",
    body: JSON.stringify({ query, variables }),
    headers,
  }).then((x) => x.json());

  /* eslint-disable @typescript-eslint/no-explicit-any */
  const sections = response.data.websoc.schools
    .flatMap((s: any) => s.departments)
    .flatMap((d: any) => d.courses)
    .flatMap((c: any) =>
      c.sections.map((s: any) => ({
        /* eslint-enable @typescript-eslint/no-explicit-any */
        status: s.status,
        num_total_enrolled: Number(s.numCurrentlyEnrolled.totalEnrolled),
        num_on_waitlist: s.numOnWaitlist,
        max_capacity: s.maxCapacity,
        quarter,
        year,
        section: { code: s.sectionCode, type: s.sectionType },
        course: { title: c.courseTitle, id: c.deptCode + c.courseNumber },
      })),
    );

  return sections as EnrollmentStatus[];
}

function updateUserID() {
  const id = prompt("Enter your AntAlmanac User ID", localStorage.aaUserID || "panteater");
  if (!id) return;
  localStorage.aaUserID = id;
  setIsUserIdPresent(true);
  updateUserSchedule(id);
}

async function updateUserSchedule(userId: string, idx?: string) {
  setClasses([]);

  const data = await fetch(`${API_BASE}/api/aa-schedule/${userId}`)
    .then((x) => x.json())
    .then((x) => x.result.data.json.userData)
    .catch(() => {});

  if (!data) {
    delete localStorage.aaUserID;
    setIsUserIdPresent(false);
    return;
  }

  const schedules: Schedule[] = data.schedules?.filter((s: Schedule) => s.courses.length);

  const index: number = idx || data.scheduleIndex;
  localStorage.enrollmentScheduleIdx = index;

  setSchedules(schedules);
  setScheduleIndex(index);

  const schedule: Schedule = schedules[index];
  const enrollments = await getEnrollmentData(schedule.courses);
  for (const enrollment of enrollments) {
    const userSec = schedule.courses.find((c) => c.sectionCode === enrollment.section.code);
    if (!userSec) continue;
    enrollment.color = userSec.color;
  }
  setClasses(enrollments);
}

function ClassesGrid() {
  // @ts-expect-error es module moment
  const colorHelper = contrastColor.default;

  return (
    <Show when={classes().length > 0}>
      <div class="classes-grid">
        {classes().map((c) => {
          const style = { "--col-accent": c.color, "--col-text": colorHelper(c.color, 0.56) };
          return (
            <div style={style} class={"course status-" + c.status.toLowerCase()}>
              <h2 class="class-name">
                {c.course.id} {c.section.type}
              </h2>
              <p>
                <b>{c.status}</b>&nbsp;({c.num_total_enrolled}/{c.max_capacity}),{" "}
                {c.num_on_waitlist} WL
              </p>
            </div>
          );
        })}
      </div>
      <p>
        Enrollment data via{" "}
        <a href="https://icssc.link/about-anteaterapi" target="_blank">
          Anteater API
        </a>
      </p>
    </Show>
  );
}

function changeSchedule(event: InputEvent) {
  const index = (event.target as HTMLSelectElement).value;
  setScheduleIndex(parseInt(index));
  updateUserSchedule(localStorage.aaUserID, index);
}

function ScheduleSelect() {
  return (
    <select
      name="schedule-select"
      id="schedule-select"
      value={scheduleIndex()}
      onInput={changeSchedule}
    >
      {schedules().map((s, i) => (
        <option value={i}>{s.scheduleName}</option>
      ))}
    </select>
  );
}

function NoAntAlamanacID() {
  return (
    <>
      <h2 class="center">
        No Schedule Yet
        <br />
        <SlantWrapper>
          <button onClick={updateUserID} class="padded">
            <i class="fa fa-plus"></i> <span>Add from AntAlmanac</span>
          </button>
        </SlantWrapper>
      </h2>
    </>
  );
}

const [schedules, setSchedules] = createSignal<Schedule[]>([]);
const [scheduleIndex, setScheduleIndex] = createSignal(0);
const [classes, setClasses] = createSignal<EnrollmentStatus[]>([]);
const [isUserIdPresent, setIsUserIdPresent] = createSignal("aaUserID" in localStorage);

export default function Enrollment() {
  document.title = "Class Enrollment Status | Ant Atlas";
  if (localStorage.aaUserID && !schedules().length) {
    updateUserSchedule(localStorage.aaUserID, localStorage.enrollmentScheduleIdx);
  }

  return (
    <>
      <h1 class="app-header">
        <SlantWrapper highContrast>
          <span>
            <i class="fa fa-calendar-o"></i> Class Enrollment
          </span>
        </SlantWrapper>
        <SlantWrapper>
          <ScheduleSelect />
        </SlantWrapper>
        <SlantWrapper>
          <button onClick={updateUserID}>
            <i class="fa fa-calendar-plus-o"></i>{" "}
          </button>
        </SlantWrapper>
      </h1>
      <div class="content-wrapper">{isUserIdPresent() ? <ClassesGrid /> : <NoAntAlamanacID />}</div>
    </>
  );
}
