package com.artemyasnik.evac.server.simulation;

/**
 * Место под симуляцию эвакуации. Реализацию пишет другой человек.
 * <p>
 * В Фазе 0' — только интерфейс-заглушка. Не вызывается из основного кода.
 */
public interface EvacuationSimulator {

    /**
     * Запустить симуляцию для здания/сценария.
     *
     * @param input входные данные (здание + сценарий)
     * @return результат симуляции
     */
    SimulationResult run(Object input);
}