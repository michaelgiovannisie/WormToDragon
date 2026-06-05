package com.conviction.imports.parser;

import com.conviction.imports.dto.RobinhoodCsvRow;
import com.opencsv.CSVReader;
import org.springframework.stereotype.Component;
import org.springframework.web.multipart.MultipartFile;

import java.io.InputStreamReader;
import java.util.*;
import java.util.stream.IntStream;

@Component
public class RobinhoodCsvParser {

    public List<RobinhoodCsvRow> parse(
            MultipartFile file
    ) {
        try (
                CSVReader reader = new CSVReader(
                        new InputStreamReader(
                                file.getInputStream()
                        )
                )
        ) {

            List<String[]> rows = reader.readAll();

            if (rows.isEmpty()) {
                return List.of();
            }

            String[] headers = rows.get(0);

            List<RobinhoodCsvRow> parsedRows =
                    rows.stream()
                            .skip(1)
                            .map(row -> {

                                Map<String, String> values =
                                        IntStream.range(
                                                        0,
                                                        Math.min(
                                                                headers.length,
                                                                row.length
                                                        )
                                                )
                                                .boxed()
                                                .collect(
                                                        HashMap::new,
                                                        (map, index) ->
                                                                map.put(
                                                                        headers[index].trim(),
                                                                        row[index].trim()
                                                                ),
                                                        HashMap::putAll
                                                );

                                return new RobinhoodCsvRow(values);
                            })
                            .toList();

            return parsedRows;

        } catch (Exception e) {
            throw new RuntimeException(
                    "Failed to parse Robinhood CSV"
            );
        }
    }
}