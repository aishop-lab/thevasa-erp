import { NextRequest, NextResponse } from "next/server";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    // Verify the requesting user is authenticated and is an admin
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check the requesting user is an admin of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("role, team_id")
      .eq("user_id", user.id)
      .single();

    if (!membership || membership.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can invite team members" },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email, role, teamId } = body;

    if (!email || !role || !teamId) {
      return NextResponse.json(
        { error: "Email, role, and teamId are required" },
        { status: 400 }
      );
    }

    // Verify the teamId matches the admin's team
    if (teamId !== membership.team_id) {
      return NextResponse.json(
        { error: "Cannot invite to a different team" },
        { status: 403 }
      );
    }

    // Use service role client to invite user
    const adminClient = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if user already exists in the team
    const { data: existingMembers } = await adminClient
      .from("team_members")
      .select("id, user:users(email)")
      .eq("team_id", teamId);

    const alreadyMember = (existingMembers ?? []).some(
      (m: any) => m.user?.email === email
    );

    if (alreadyMember) {
      return NextResponse.json(
        { error: "This user is already a member of the team" },
        { status: 409 }
      );
    }

    // Invite user via Supabase Auth (sends invitation email)
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          team_id: teamId,
          role: role,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/invite/accept`,
      });

    if (inviteError) {
      return NextResponse.json(
        { error: inviteError.message },
        { status: 400 }
      );
    }

    // Create the team_member record with the invited user's ID
    if (inviteData.user) {
      const { error: memberError } = await adminClient
        .from("team_members")
        .insert({
          team_id: teamId,
          user_id: inviteData.user.id,
          role: role,
        });

      if (memberError) {
        console.error("[Team Invite] Failed to create team_member:", memberError);
        return NextResponse.json(
          { error: "Invitation sent but failed to add to team. Please try again." },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Invitation sent to ${email}`,
    });
  } catch (error) {
    console.error("[Team Invite] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
