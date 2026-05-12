import { type ParentProps } from "solid-js";
import "./App.scss";
import { A, Route, Router } from "@solidjs/router";
import Menu from "./dining/Menu";
import Arrivals from "./antex/Arrivals";
import Enrollment from "./enrollment/Enrollment";
import Spaces from "./spaces/Spaces";

interface PageButtonProps {
  icon: string;
  currentPage?: string;
  setPage?: (page: string) => void;
  path: string;
  title: string;
  description: string;
}

function PageButton(props: PageButtonProps) {
  return (
    <A href={props.path} end title={props.description}>
      <i class={`fa fa-fw fa-${props.icon}`}></i>
      <span>{props.title}</span>
    </A>
  );
}

function App(props: ParentProps) {
  return (
    <>
      {props.children}
      <div class="bottom-bar">
        <PageButton icon="coffee" path="/" title="Menus" description="Dining Menus" />
        <PageButton
          icon="bus"
          path="/antex/"
          title="Arrivals"
          description="Anteater Express Arrivals"
        />
        <PageButton
          icon="calendar-o"
          path="/enrollment/"
          title="Enrollment"
          description="Class Enrollment Status"
        />
        <PageButton icon="tv" path="/spaces/" title="Spaces" description="Study Spaces" />
      </div>
    </>
  );
}

function AppRouter() {
  return (
    <Router root={App}>
      <Route path="/" component={Menu} />
      <Route path="/antex/" component={Arrivals} />
      <Route path="/enrollment/" component={Enrollment} />
      <Route path="/spaces/" component={Spaces} />
    </Router>
  );
}

export default AppRouter;
