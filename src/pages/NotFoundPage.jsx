import { Link } from "react-router-dom";
import SectionCard from "../components/ui/SectionCard";

function NotFoundPage() {
  return (
    <SectionCard title="Страница не найдена" subtitle="Похоже, этот маршрут в админке пока не настроен.">
      <Link to="/" className="btn btn-primary">
        Вернуться на dashboard
      </Link>
    </SectionCard>
  );
}

export default NotFoundPage;
