"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface InviteMemberInput {
  email: string;
  role: "admin" | "manager" | "viewer" | "accountant";
  teamId: string;
}

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

const teamKeys = {
  all: ["team"] as const,
  detail: () => [...teamKeys.all, "detail"] as const,
  members: () => [...teamKeys.all, "members"] as const,
  currentUser: () => [...teamKeys.all, "current-user"] as const,
};

// ---------------------------------------------------------------------------
// Hooks
// ---------------------------------------------------------------------------

/**
 * Fetch the current user's team information.
 *
 * Resolves the team via the authenticated user's team membership.
 */
export function useTeam() {
  const supabase = createClient();

  return useQuery({
    queryKey: teamKeys.detail(),
    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      // Get the user's team membership, then the team
      const { data, error } = await supabase
        .from("team_members")
        .select(
          `
          team:teams (*)
        `
        )
        .eq("user_id", user.id)
        .single();

      if (error) throw error;
      return data?.team ?? null;
    },
  });
}

/**
 * Fetch all members of the current user's team.
 */
export function useTeamMembers() {
  const supabase = createClient();

  return useQuery({
    queryKey: teamKeys.members(),
    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      // First get the user's team ID
      const { data: membership, error: membershipError } = await supabase
        .from("team_members")
        .select("team_id")
        .eq("user_id", user.id)
        .single();

      if (membershipError) throw membershipError;
      if (!membership) throw new Error("No team membership found");

      // Then get all members of that team
      const { data, error } = await supabase
        .from("team_members")
        .select(
          `
          *,
          user:users (*)
        `
        )
        .eq("team_id", membership.team_id)
        .order("created_at", { ascending: true });

      if (error) throw error;
      return data;
    },
  });
}

/**
 * Fetch the current authenticated user with their role in the team.
 */
export function useCurrentUser() {
  const supabase = createClient();

  return useQuery({
    queryKey: teamKeys.currentUser(),
    queryFn: async () => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      // Get their team membership including role
      const { data: membership, error: membershipError } = await supabase
        .from("team_members")
        .select(
          `
          role,
          team:teams (*)
        `
        )
        .eq("user_id", user.id)
        .single();

      if (membershipError) throw membershipError;

      return {
        id: user.id,
        email: user.email,
        role: membership?.role ?? null,
        team: membership?.team ?? null,
      };
    },
  });
}

/**
 * Mutation to invite a new member to the team.
 *
 * Creates a team invitation record that the invited user can accept.
 */
export function useInviteMember() {
  const supabase = createClient();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: InviteMemberInput) => {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError) throw authError;
      if (!user) throw new Error("Not authenticated");

      // Insert directly into team_members (invitation flow is simplified for v1)
      const { data, error } = await supabase
        .from("team_members" as any)
        .insert({
          team_id: input.teamId,
          user_id: user.id, // Placeholder - in production, look up user by email
          role: input.role,
        } as any)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamKeys.members() });
    },
  });
}
