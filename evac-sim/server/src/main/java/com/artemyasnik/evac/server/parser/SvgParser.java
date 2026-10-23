package com.artemyasnik.evac.server.parser;

/**
 * Место под парсер SVG. Реализацию пишет другой человек.
 * <p>
 * В Фазе 0' — только интерфейс-заглушка, чтобы было видно,
 * куда класть код. Не вызывается из основного кода.
 */
public interface SvgParser {

    /**
     * Разобрать SVG-текст в структуру этажа.
     *
     * @param svgText    содержимое SVG
     * @param floorName  название этажа
     * @param level      номер этажа (чем меньше, тем ниже)
     * @return разобранный этаж (DTO)
     */
    Object parse(String svgText, String floorName, int level);
}