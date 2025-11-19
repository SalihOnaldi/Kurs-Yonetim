using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using SRC.Infrastructure.Data;
using SRC.Domain.Entities;
using System.Security.Claims;

namespace SRC.Presentation.Api.Controllers.Hq;

[ApiController]
[Route("api/hq/accounts")]
[Authorize(Roles = "PlatformOwner")]
public class HqAccountsController : ControllerBase
{
    private readonly SrcDbContext _context;

    public HqAccountsController(SrcDbContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult> GetTransactions(
        [FromQuery] string? tenantId,
        [FromQuery] string? type,
        [FromQuery] string? category,
        [FromQuery] DateTime? startDate,
        [FromQuery] DateTime? endDate,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.AccountTransactions
            .IgnoreQueryFilters()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            query = query.Where(t => t.TenantId == tenantId);
        }

        if (!string.IsNullOrWhiteSpace(type))
        {
            query = query.Where(t => t.Type == type);
        }

        if (!string.IsNullOrWhiteSpace(category))
        {
            query = query.Where(t => t.Category == category);
        }

        if (startDate.HasValue)
        {
            query = query.Where(t => t.TransactionDate >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            query = query.Where(t => t.TransactionDate <= endDate.Value);
        }

        var totalCount = await query.CountAsync();
        var transactions = await query
            .OrderByDescending(t => t.TransactionDate)
            .ThenByDescending(t => t.CreatedAt)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(t => new
            {
                t.Id,
                t.TenantId,
                t.TransactionDate,
                t.Type,
                t.Category,
                t.Description,
                t.Amount,
                t.Reference,
                t.Notes,
                t.CreatedBy,
                t.CreatedAt
            })
            .ToListAsync();

        // Özet bilgileri hesapla
        var summaryQuery = _context.AccountTransactions
            .IgnoreQueryFilters()
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(tenantId))
        {
            summaryQuery = summaryQuery.Where(t => t.TenantId == tenantId);
        }

        if (startDate.HasValue)
        {
            summaryQuery = summaryQuery.Where(t => t.TransactionDate >= startDate.Value);
        }

        if (endDate.HasValue)
        {
            summaryQuery = summaryQuery.Where(t => t.TransactionDate <= endDate.Value);
        }

        var totalIncome = await summaryQuery
            .Where(t => t.Type == "income")
            .SumAsync(t => (decimal?)t.Amount) ?? 0;

        var totalExpense = await summaryQuery
            .Where(t => t.Type == "expense")
            .SumAsync(t => (decimal?)t.Amount) ?? 0;

        var balance = totalIncome - totalExpense;

        return Ok(new
        {
            transactions,
            pagination = new
            {
                page,
                pageSize,
                totalCount,
                totalPages = (int)Math.Ceiling(totalCount / (double)pageSize)
            },
            summary = new
            {
                totalIncome,
                totalExpense,
                balance
            }
        });
    }

    [HttpPost]
    public async Task<ActionResult> CreateTransaction([FromBody] CreateAccountTransactionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.TenantId))
        {
            return BadRequest(new { message = "TenantId gereklidir." });
        }

        // Tenant'ın var olduğunu kontrol et
        var tenant = await _context.Tenants
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == request.TenantId && t.IsActive);

        if (tenant == null)
        {
            return NotFound(new { message = "Belirtilen şube bulunamadı." });
        }

        var transaction = new AccountTransaction
        {
            TenantId = request.TenantId,
            TransactionDate = request.TransactionDate,
            Type = request.Type,
            Category = request.Category,
            Description = request.Description,
            Amount = request.Amount,
            Reference = request.Reference,
            Notes = request.Notes,
            CreatedBy = User.FindFirst(ClaimTypes.Name)?.Value ?? "System"
        };

        _context.AccountTransactions.Add(transaction);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = transaction.Id }, new
        {
            transaction.Id,
            transaction.TenantId,
            transaction.TransactionDate,
            transaction.Type,
            transaction.Category,
            transaction.Description,
            transaction.Amount,
            transaction.Reference,
            transaction.Notes,
            transaction.CreatedBy,
            transaction.CreatedAt
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult> GetById(int id)
    {
        var transaction = await _context.AccountTransactions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (transaction == null)
        {
            return NotFound();
        }

        return Ok(transaction);
    }

    [HttpPut("{id}")]
    public async Task<ActionResult> UpdateTransaction(int id, [FromBody] UpdateAccountTransactionRequest request)
    {
        var transaction = await _context.AccountTransactions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (transaction == null)
        {
            return NotFound();
        }

        if (request.TransactionDate.HasValue)
            transaction.TransactionDate = request.TransactionDate.Value;
        if (!string.IsNullOrWhiteSpace(request.Type))
            transaction.Type = request.Type;
        if (!string.IsNullOrWhiteSpace(request.Category))
            transaction.Category = request.Category;
        if (!string.IsNullOrWhiteSpace(request.Description))
            transaction.Description = request.Description;
        if (request.Amount.HasValue)
            transaction.Amount = request.Amount.Value;
        if (request.Reference != null)
            transaction.Reference = request.Reference;
        if (request.Notes != null)
            transaction.Notes = request.Notes;

        await _context.SaveChangesAsync();

        return Ok(transaction);
    }

    [HttpDelete("{id}")]
    public async Task<ActionResult> DeleteTransaction(int id)
    {
        var transaction = await _context.AccountTransactions
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(t => t.Id == id);

        if (transaction == null)
        {
            return NotFound();
        }

        _context.AccountTransactions.Remove(transaction);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}

public class CreateAccountTransactionRequest
{
    public string TenantId { get; set; } = default!;
    public DateTime TransactionDate { get; set; }
    public string Type { get; set; } = default!; // "income" veya "expense"
    public string Category { get; set; } = default!;
    public string Description { get; set; } = default!;
    public decimal Amount { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
}

public class UpdateAccountTransactionRequest
{
    public DateTime? TransactionDate { get; set; }
    public string? Type { get; set; }
    public string? Category { get; set; }
    public string? Description { get; set; }
    public decimal? Amount { get; set; }
    public string? Reference { get; set; }
    public string? Notes { get; set; }
}

