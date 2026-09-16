// Static endpoint: the public graph (nodes, edges, hubs, tag counts) consumed by the hero canvas and the /notes 2D map.
import type { APIRoute } from 'astro';
import { getGraph, toPublicGraph } from '../lib/graph.ts';

export const GET: APIRoute = () =>
  new Response(JSON.stringify(toPublicGraph(getGraph())), {
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=0, must-revalidate' },
  });
