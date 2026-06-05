package com.conviction.valuation.repository;

import java.util.List;
import java.util.UUID;

import org.springframework.data.jpa.repository.JpaRepository;

import com.conviction.valuation.entity.ValuationScenario;

public interface ValuationScenarioRepository
        extends JpaRepository<ValuationScenario, UUID> {

    List<ValuationScenario> findBySymbolOrderByCreatedAtDesc(String symbol);
}