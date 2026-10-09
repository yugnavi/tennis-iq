import { ROUTES } from '../app/App';
import { ButtonLink, Card, Page, TopBar } from '../components/ui';

export default function NotFoundPage() {
  return (
    <Page header={<TopBar title="Out of bounds" backTo={ROUTES.home} />}>
      <Card className="text-center">
        <h2 className="text-xl font-bold">That ball landed out</h2>
        <p className="mt-2">We couldn’t find this page.</p>
        <ButtonLink to={ROUTES.home} block className="mt-4">
          Back to Home
        </ButtonLink>
      </Card>
    </Page>
  );
}
