export const TaskLink = ({ id }) => (
  <a className="tasklink" href={`#/task/${id}`}>
    {id}
  </a>
);

// Turns every task key (MM-123) inside a piece of text into a link to its page.
export const linkTasks = (text) =>
  String(text)
    .split(/(MM-\d+)/g)
    .map((part, i) => (/^MM-\d+$/.test(part) ? <TaskLink key={i} id={part} /> : part));
