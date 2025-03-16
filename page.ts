export function generateMetadata({ params }: { params: { id: string } }) {
  // For metadata, we can now use Promise.resolve for safer usage
  // but this is not an async function, so we don't use await
  const id = params.id;
  return {
    title: `Event Agenda - ${id}`,
  };
}

export default async function EventPage({ params }: { params: { id: string } }) {
  const id = await Promise.resolve(params.id);
  // Rest of function...
} 