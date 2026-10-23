package com.artemyasnik.evac.server.simulation;

/**
 * Заглушка результата симуляции. Реализацию пишет другой человек.
 */
public record SimulationResult(
        long evacuationTimeSeconds,
        int peopleEvacuated,
        int peopleStuck,
        int peopleDead
) {
}