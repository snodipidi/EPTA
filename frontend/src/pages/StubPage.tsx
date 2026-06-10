import "./StubPage.css";

interface StubPageProps {
  title: string;
}

export function StubPage({ title }: StubPageProps) {
  return (
    <div className="stub-page">
      <h1 className="stub-page__title">{title}</h1>
      <p className="stub-page__text">В стадии разработки</p>
    </div>
  );
}
