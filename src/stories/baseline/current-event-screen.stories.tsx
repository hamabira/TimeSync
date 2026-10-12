import type { Meta, StoryObj } from "@storybook/nextjs-vite";

import { CurrentEventScreen } from "./current-event-screen";
import { fixtureEvent, fixtureParticipants } from "../fixtures";

const meta = {
  title: "Review/Current event",
  component: CurrentEventScreen,
  args: {
    event: fixtureEvent,
    participants: fixtureParticipants,
  },
  parameters: {
    layout: "fullscreen",
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof CurrentEventScreen>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};

export const Empty: Story = {
  args: {
    participants: [],
    initialDraftSlots: [],
  },
};
