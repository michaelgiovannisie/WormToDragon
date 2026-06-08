package com.conviction.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.scheduling.annotation.EnableAsync;
import org.springframework.scheduling.concurrent.ThreadPoolTaskExecutor;

import java.util.concurrent.Executor;

@Configuration
@EnableAsync
public class AsyncConfig {

    /**
     * Single-threaded executor for the NASDAQ-100 batch sync.
     * Single thread = sequential, throttled FMP calls — no parallel bursts.
     * Queue capacity of 1 means a second "start" request while one is already
     * queued will be rejected (the service guards this with an AtomicBoolean anyway).
     */
    @Bean(name = "nasdaq100Executor")
    public Executor nasdaq100Executor() {
        ThreadPoolTaskExecutor executor = new ThreadPoolTaskExecutor();
        executor.setCorePoolSize(1);
        executor.setMaxPoolSize(1);
        executor.setQueueCapacity(1);
        executor.setThreadNamePrefix("nasdaq100-sync-");
        executor.initialize();
        return executor;
    }
}
