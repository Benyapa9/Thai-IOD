import { demoLoginEnabled } from "@/lib/auth";
import { ProfileView } from "./profile-view";

export default function ProfilePage() {
  return <ProfileView demoEnabled={demoLoginEnabled} />;
}
