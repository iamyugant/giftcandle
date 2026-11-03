import { Skeleton, Tab, TabList, Text } from "@vibe/core";
import { useEffect, useState } from "react";
import { AdminScreen } from "./AdminScreen";
import { monday } from "./api";
import { OrderScreen } from "./OrderScreen";

function readViewContext(data) {
  const { boardId } = data;
  if (boardId == null) return null;

  return { boardId: String(boardId) };
}

export function App() {
  const [context, setContext] = useState(null);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    monday
      .get("context")
      .then((res) => setContext(readViewContext(res.data)))
      .catch(() => undefined)
      .finally(() => setReady(true));
  }, []);

  if (!ready) return <Skeleton height={200} />;

  if (!context) {
    return (
      <main style={{ padding: 16 }}>
        <Text>Open this app as the Order view on a monday board.</Text>
      </main>
    );
  }

  return (
    <>
      <TabList activeTabId={tab} onTabChange={setTab}>
        <Tab>New order</Tab>
        <Tab>Fragrances</Tab>
      </TabList>
      {tab === 0 ? <OrderScreen boardId={context.boardId} /> : <AdminScreen />}
    </>
  );
}
