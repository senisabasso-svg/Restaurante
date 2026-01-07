using CornerApp.API.Helpers;
using FluentAssertions;
using Xunit;

namespace CornerApp.API.Tests.Helpers;

public class ETagHelperTests
{
    [Fact]
    public void GenerateETagFromString_WithValidString_ReturnsETag()
    {
        // Arrange
        var content = "test content";

        // Act
        var etag = ETagHelper.GenerateETagFromString(content);

        // Assert
        etag.Should().NotBeNullOrEmpty();
        etag.Should().StartWith("\"");
        etag.Should().EndWith("\"");
    }

    [Fact]
    public void GenerateETagFromString_WithEmptyString_ReturnsETag()
    {
        // Arrange
        var content = string.Empty;

        // Act
        var etag = ETagHelper.GenerateETagFromString(content);

        // Assert
        etag.Should().NotBeNullOrEmpty();
        etag.Should().StartWith("\"");
        etag.Should().EndWith("\"");
    }

    [Fact]
    public void GenerateETagFromString_WithNullString_ReturnsETag()
    {
        // Arrange
        string? content = null;

        // Act
        var etag = ETagHelper.GenerateETagFromString(content!);

        // Assert
        etag.Should().NotBeNullOrEmpty();
        etag.Should().StartWith("\"");
        etag.Should().EndWith("\"");
    }

    [Fact]
    public void GenerateETagFromString_WithSameContent_ReturnsSameETag()
    {
        // Arrange
        var content = "same content";

        // Act
        var etag1 = ETagHelper.GenerateETagFromString(content);
        var etag2 = ETagHelper.GenerateETagFromString(content);

        // Assert
        etag1.Should().Be(etag2);
    }

    [Fact]
    public void GenerateETagFromString_WithDifferentContent_ReturnsDifferentETag()
    {
        // Arrange
        var content1 = "content 1";
        var content2 = "content 2";

        // Act
        var etag1 = ETagHelper.GenerateETagFromString(content1);
        var etag2 = ETagHelper.GenerateETagFromString(content2);

        // Assert
        etag1.Should().NotBe(etag2);
    }

    [Fact]
    public void GenerateETag_WithObject_ReturnsETag()
    {
        // Arrange
        var obj = new { Name = "Test", Value = 123 };

        // Act
        var etag = ETagHelper.GenerateETag(obj);

        // Assert
        etag.Should().NotBeNullOrEmpty();
        etag.Should().StartWith("\"");
        etag.Should().EndWith("\"");
    }

    [Fact]
    public void GenerateETag_WithNull_ReturnsETag()
    {
        // Arrange
        object? obj = null;

        // Act
        var etag = ETagHelper.GenerateETag(obj);

        // Assert
        etag.Should().NotBeNullOrEmpty();
        etag.Should().StartWith("\"");
        etag.Should().EndWith("\"");
    }

    [Fact]
    public void GenerateETag_WithSameObject_ReturnsSameETag()
    {
        // Arrange
        var obj1 = new { Name = "Test", Value = 123 };
        var obj2 = new { Name = "Test", Value = 123 };

        // Act
        var etag1 = ETagHelper.GenerateETag(obj1);
        var etag2 = ETagHelper.GenerateETag(obj2);

        // Assert
        etag1.Should().Be(etag2);
    }

    [Fact]
    public void GenerateETagFromVersion_WithVersion_ReturnsETag()
    {
        // Arrange
        var version = "1.0.0";

        // Act
        var etag = ETagHelper.GenerateETagFromVersion(version);

        // Assert
        etag.Should().NotBeNullOrEmpty();
        etag.Should().StartWith("\"");
        etag.Should().EndWith("\"");
    }

    [Fact]
    public void IsETagValid_WithMatchingETags_ReturnsTrue()
    {
        // Arrange
        var content = "test content";
        var serverETag = ETagHelper.GenerateETagFromString(content);
        var clientETag = serverETag;

        // Act
        var isValid = ETagHelper.IsETagValid(clientETag, serverETag);

        // Assert
        isValid.Should().BeTrue();
    }

    [Fact]
    public void IsETagValid_WithDifferentETags_ReturnsFalse()
    {
        // Arrange
        var serverETag = ETagHelper.GenerateETagFromString("content 1");
        var clientETag = ETagHelper.GenerateETagFromString("content 2");

        // Act
        var isValid = ETagHelper.IsETagValid(clientETag, serverETag);

        // Assert
        isValid.Should().BeFalse();
    }

    [Fact]
    public void IsETagValid_WithNullClientETag_ReturnsFalse()
    {
        // Arrange
        var serverETag = ETagHelper.GenerateETagFromString("content");

        // Act
        var isValid = ETagHelper.IsETagValid(null, serverETag);

        // Assert
        isValid.Should().BeFalse();
    }

    [Fact]
    public void IsETagValid_WithEmptyClientETag_ReturnsFalse()
    {
        // Arrange
        var serverETag = ETagHelper.GenerateETagFromString("content");

        // Act
        var isValid = ETagHelper.IsETagValid("", serverETag);

        // Assert
        isValid.Should().BeFalse();
    }

    [Fact]
    public void IsETagValid_WithETagsWithoutQuotes_ReturnsTrue()
    {
        // Arrange
        var content = "test content";
        var serverETag = ETagHelper.GenerateETagFromString(content);
        var clientETag = serverETag.Trim('"');

        // Act
        var isValid = ETagHelper.IsETagValid(clientETag, serverETag);

        // Assert
        isValid.Should().BeTrue();
    }

    [Fact]
    public void IsWildcardETag_WithWildcard_ReturnsTrue()
    {
        // Arrange
        var clientETag = "*";

        // Act
        var isWildcard = ETagHelper.IsWildcardETag(clientETag);

        // Assert
        isWildcard.Should().BeTrue();
    }

    [Fact]
    public void IsWildcardETag_WithNormalETag_ReturnsFalse()
    {
        // Arrange
        var clientETag = ETagHelper.GenerateETagFromString("content");

        // Act
        var isWildcard = ETagHelper.IsWildcardETag(clientETag);

        // Assert
        isWildcard.Should().BeFalse();
    }

    [Fact]
    public void IsWildcardETag_WithNull_ReturnsFalse()
    {
        // Act
        var isWildcard = ETagHelper.IsWildcardETag(null);

        // Assert
        isWildcard.Should().BeFalse();
    }
}
