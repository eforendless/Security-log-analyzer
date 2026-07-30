interface PageTitleProps {
  title: string;
}

export function PageTitle({ title }: PageTitleProps): React.JSX.Element {
  return <h1 className="text-xl font-semibold text-slate-100">{title}</h1>;
}
