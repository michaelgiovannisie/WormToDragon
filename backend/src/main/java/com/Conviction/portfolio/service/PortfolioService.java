package com.conviction.portfolio.service;

import java.util.List;
import java.util.UUID;

import org.springframework.stereotype.Service;

import com.conviction.auth.entity.User;
import com.conviction.auth.repository.UserRepository;
import com.conviction.portfolio.dto.CreatePortfolioRequest;
import com.conviction.portfolio.dto.PortfolioResponse;
import com.conviction.portfolio.entity.Portfolio;
import com.conviction.portfolio.repository.PortfolioRepository;

@Service
public class PortfolioService {

    private final PortfolioRepository portfolioRepository;
    private final UserRepository userRepository;

    public PortfolioService(
            PortfolioRepository portfolioRepository,
            UserRepository userRepository
    ) {
        this.portfolioRepository = portfolioRepository;
        this.userRepository = userRepository;
    }

    public PortfolioResponse createPortfolio(CreatePortfolioRequest request) {
        User user = userRepository.findById(request.userId())
                .orElseThrow(() -> new IllegalArgumentException("User not found"));

        Portfolio portfolio = new Portfolio();
        portfolio.setName(request.name());
        portfolio.setDescription(request.description());
        portfolio.setBenchmark(
                request.benchmark() == null || request.benchmark().isBlank()
                        ? "VOO"
                        : request.benchmark()
        );
        portfolio.setTaxStrategy(
                request.taxStrategy() == null || request.taxStrategy().isBlank()
                        ? "FIFO"
                        : request.taxStrategy()
        );
        portfolio.setUser(user);

        Portfolio savedPortfolio = portfolioRepository.save(portfolio);

        return toResponse(savedPortfolio);
    }

    public PortfolioResponse getPortfolio(UUID portfolioId) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        return toResponse(portfolio);
    }

    public PortfolioResponse updateTaxStrategy(UUID portfolioId, String taxStrategy) {
        Portfolio portfolio = portfolioRepository.findById(portfolioId)
                .orElseThrow(() -> new IllegalArgumentException("Portfolio not found"));
        portfolio.setTaxStrategy(taxStrategy);
        return toResponse(portfolioRepository.save(portfolio));
    }

    public List<PortfolioResponse> getPortfoliosByUserId(UUID userId) {
        return portfolioRepository.findByUserIdAndActiveTrue(userId)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private PortfolioResponse toResponse(Portfolio portfolio) {
        return new PortfolioResponse(
                portfolio.getId(),
                portfolio.getName(),
                portfolio.getDescription(),
                portfolio.getBenchmark(),
                portfolio.getTaxStrategy(),
                portfolio.getActive(),
                portfolio.getUser().getId(),
                portfolio.getCreatedAt()
        );
    }
}